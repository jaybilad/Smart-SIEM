-- =====================================================================
-- SMART SIEM — CTU — SCHEMA POSTGRESQL
-- Conforme au "dictionnaire officiel du projet" fourni :
--   - Liste fermée d'hôtes surveillés
--   - Liste fermée d'event_type
--   - Liste fermée d'attack_type
--   - Liste fermée de severity
--   - Liste fermée de statuts d'incident
-- Toute valeur hors dictionnaire est REFUSÉE par la base (ENUM PostgreSQL).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- pour gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1. TYPES ENUM — vocabulaire officiel, verrouillé au niveau base
-- ---------------------------------------------------------------------

CREATE TYPE host_type_enum AS ENUM (
  'Serveur Web',
  'Serveur VPN',
  'Serveur Base de Données',
  'Serveur Active Directory simulé',
  'Poste utilisateur'
);

CREATE TYPE event_type_enum AS ENUM (
  'AUTH_SUCCESS',
  'AUTH_FAILED',
  'VPN_CONNECTION',
  'FILE_DOWNLOAD',
  'FILE_UPLOAD',
  'INTERNAL_CONNECTION',
  'SERVICE_STARTED',
  'SERVICE_STOPPED',
  'LOG_DELETION',
  'USER_CREATED',
  'USER_DISABLED',
  'MALWARE_DETECTED'
);

CREATE TYPE attack_type_enum AS ENUM (
  'BRUTE_FORCE',
  'DATA_EXFILTRATION',
  'LATERAL_MOVEMENT',
  'LOG_TAMPERING',
  'ANOMALOUS_LOGIN'
);

CREATE TYPE severity_enum AS ENUM (
  'INFO',
  'WARNING',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE incident_status_enum AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED'
);

-- Statut technique d'un log (SUCCESS/FAILED) — non listé explicitement
-- dans le dictionnaire mais nécessaire pour distinguer AUTH_SUCCESS/AUTH_FAILED
-- et les événements neutres (ex: FILE_DOWNLOAD). Laissé volontairement souple.
CREATE TYPE log_status_enum AS ENUM (
  'SUCCESS',
  'FAILED',
  'INFO'
);

-- ---------------------------------------------------------------------
-- 2. INFRASTRUCTURE SURVEILLÉE — liste fermée (WEB-01, VPN-01, DB-01,
--    AD-01, ENDPOINT-01 à ENDPOINT-20)
-- ---------------------------------------------------------------------

CREATE TABLE hosts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname    varchar(50)     NOT NULL UNIQUE,
  host_type   host_type_enum  NOT NULL,
  ip_address  inet,
  status      varchar(20)     NOT NULL DEFAULT 'Actif' CHECK (status IN ('Actif', 'Inactif')),
  created_at  timestamp       NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. COMPTES SOC (RBAC — interface admin)
-- ---------------------------------------------------------------------

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username       varchar(50)  NOT NULL UNIQUE,
  email          varchar(120) UNIQUE,
  password_hash  varchar(255) NOT NULL,
  password_plain varchar(255),
  role           varchar(20)  NOT NULL CHECK (role IN ('Admin', 'Analyste', 'Lecteur')),
  scope          varchar(30)  NOT NULL DEFAULT 'Global'
                 CHECK (scope IN ('Global', 'RH', 'Filiale Europe', 'Dev', 'Prod')),
  is_active      boolean      NOT NULL DEFAULT true,
  last_login_at  timestamp,
  created_at     timestamp    NOT NULL DEFAULT now(),
  updated_at     timestamp
);

-- ---------------------------------------------------------------------
-- 4. PLAYBOOKS SOAR & RÈGLES DE CORRÉLATION
-- ---------------------------------------------------------------------

CREATE TABLE playbooks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attack_type   attack_type_enum,
  action_name   varchar(120) NOT NULL,
  description   text,
  is_automatic  boolean      NOT NULL DEFAULT false
);

CREATE TABLE attack_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attack_type           attack_type_enum NOT NULL,
  rule_name             varchar(120)     NOT NULL,
  description           text,
  threshold             integer          NOT NULL,
  time_window_seconds   integer          NOT NULL,
  severity              severity_enum    NOT NULL,
  enabled               boolean          NOT NULL DEFAULT true,
  playbook_id           uuid REFERENCES playbooks(id) ON DELETE SET NULL,
  created_at            timestamp        NOT NULL DEFAULT now(),
  updated_at            timestamp
);

-- ---------------------------------------------------------------------
-- 5. LOGS — structure officielle exacte du dictionnaire
-- ---------------------------------------------------------------------

CREATE TABLE logs (
  id              bigserial PRIMARY KEY,
  "timestamp"     timestamp        NOT NULL,
  host_id         uuid             NOT NULL REFERENCES hosts(id),
  source_ip       inet,
  destination_ip  inet,
  "user"          varchar(50),                 -- champ "user" du dictionnaire (mot réservé -> guillemets)
  event_type      event_type_enum  NOT NULL,
  severity        severity_enum    NOT NULL,
  status          log_status_enum,
  data_volume     bigint           NOT NULL DEFAULT 0,
  raw_message     text,
  created_at      timestamp        NOT NULL DEFAULT now()
);

CREATE INDEX idx_logs_timestamp   ON logs ("timestamp");
CREATE INDEX idx_logs_event_type  ON logs (event_type);
CREATE INDEX idx_logs_host        ON logs (host_id);
CREATE INDEX idx_logs_user        ON logs ("user");

-- ---------------------------------------------------------------------
-- 6. ALERTES — structure officielle + rattachement à la règle déclenchée
-- ---------------------------------------------------------------------

CREATE TABLE alerts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id           uuid REFERENCES attack_rules(id),
  title             varchar(150)      NOT NULL,
  attack_type       attack_type_enum  NOT NULL,
  severity          severity_enum     NOT NULL,
  confidence_score  integer           CHECK (confidence_score BETWEEN 0 AND 100),
  description       text,
  status            incident_status_enum NOT NULL DEFAULT 'OPEN',
  created_at        timestamp         NOT NULL DEFAULT now()
);

-- Table de jonction : logs ayant contribué à déclencher une alerte
CREATE TABLE alert_logs (
  id        bigserial PRIMARY KEY,
  alert_id  uuid   NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  log_id    bigint NOT NULL REFERENCES logs(id)   ON DELETE CASCADE,
  UNIQUE (alert_id, log_id)
);

-- ---------------------------------------------------------------------
-- 7. INCIDENTS — structure officielle + attributs requis par l'UI admin
-- ---------------------------------------------------------------------

CREATE TABLE incidents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id      uuid REFERENCES alerts(id),      -- nullable: création manuelle possible
  title         varchar(150) NOT NULL,
  description   text,
  severity      severity_enum         NOT NULL,
  status        incident_status_enum  NOT NULL DEFAULT 'OPEN',
  source_ip     inet,
  target        varchar(150),                    -- compte / hôte / réseau / domaine impacté
  assigned_to   uuid REFERENCES users(id),
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp,
  closed_at     timestamp
);

CREATE TABLE incident_actions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  playbook_id       uuid NOT NULL REFERENCES playbooks(id),
  executed_by       uuid REFERENCES users(id),   -- nullable: exécution automatique SOAR
  execution_status  varchar(20) NOT NULL DEFAULT 'En attente'
                    CHECK (execution_status IN ('En attente', 'Succès', 'Échec')),
  execution_time    timestamp,
  action_note       text
);

-- ---------------------------------------------------------------------
-- 8. SUPERVISION INFRASTRUCTURE (écran AdminInfraScreen)
-- ---------------------------------------------------------------------

CREATE TABLE cluster_nodes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_name          varchar(50) NOT NULL,
  node_role          varchar(30) NOT NULL CHECK (node_role IN ('data-master', 'data')),
  cluster_name       varchar(50) NOT NULL DEFAULT 'elasticsearch',
  status             varchar(20) NOT NULL DEFAULT 'HEALTHY'
                     CHECK (status IN ('HEALTHY', 'DEGRADED', 'DOWN')),
  last_heartbeat_at  timestamp,
  created_at         timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE ingestion_metrics (
  id               bigserial PRIMARY KEY,
  recorded_at      timestamp NOT NULL DEFAULT now(),
  logs_per_second  integer   NOT NULL
);

CREATE TABLE storage_status (
  id                   bigserial PRIMARY KEY,
  recorded_at          timestamp NOT NULL DEFAULT now(),
  used_gb              numeric(10,2) NOT NULL,
  total_gb             numeric(10,2) NOT NULL,
  alert_threshold_pct  integer NOT NULL DEFAULT 80
);

CREATE TABLE retention_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retention_days  integer   NOT NULL CHECK (retention_days BETWEEN 30 AND 365),
  sealed          boolean   NOT NULL DEFAULT false,
  sealed_at       timestamp,
  sealed_by       uuid REFERENCES users(id),
  created_at      timestamp NOT NULL DEFAULT now()
);

-- Journal d'audit : append-only, aucune FK stricte, aucune contrainte
-- d'update/delete au niveau applicatif (intégrité garantie hors SQL,
-- ex: trigger REVOKE UPDATE/DELETE ou base en écriture seule).
CREATE TABLE audit_log (
  id              bigserial PRIMARY KEY,
  occurred_at     timestamp NOT NULL DEFAULT now(),
  actor_username  varchar(50) NOT NULL,   -- inclut la valeur spéciale 'SYSTEM'
  action          text        NOT NULL,
  ip_address      inet
);

-- ---------------------------------------------------------------------
-- 9. UEBA — analyse comportementale (écran AdminUEBAScreen)
-- ---------------------------------------------------------------------

CREATE TABLE user_risk_scores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id),
  risk_score        integer NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  anomalies_count   integer NOT NULL DEFAULT 0,
  delta_24h         integer NOT NULL DEFAULT 0,
  last_activity_at  timestamp,
  summary           text,
  model_version     varchar(20) NOT NULL DEFAULT 'UEBA v3.1',
  computed_at       timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE anomalies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id),
  anomaly_type       varchar(80) NOT NULL,
  description        text,
  detected_at        timestamp   NOT NULL DEFAULT now(),
  risk_contribution  integer
);
