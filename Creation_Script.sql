CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- 1. ENUMS & VOCABULAIRE OFFICIEL
-- =====================================================================
CREATE TYPE target_type_enum AS ENUM ('USER', 'HOST');
CREATE TYPE attack_type_enum AS ENUM ('BRUTE_FORCE', 'DATA_EXFILTRATION', 'LATERAL_MOVEMENT', 'NETWORK_SCANNING', 'ANOMALOUS_LOGIN');
CREATE TYPE severity_enum AS ENUM ('INFO', 'WARNING', 'HIGH', 'CRITICAL');
CREATE TYPE incident_status_enum AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE scope_enum AS ENUM ('Global', 'Reseau_Interne', 'Serveurs_Critiques', 'Frontiere');
CREATE TYPE execution_status_enum AS ENUM ('En attente', 'Succes', 'Echec');
CREATE TYPE target_status_enum AS ENUM ('Actif', 'Verrouille', 'Isole');

-- =====================================================================
-- 2. COMPTES DES OPÉRATEURS SOC (RBAC)
-- =====================================================================
CREATE TABLE soc_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username varchar(50) NOT NULL UNIQUE,
    email varchar(120) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    role varchar(20) NOT NULL CHECK (role IN ('Admin', 'Analyste', 'Lecteur')),
    scope scope_enum NOT NULL DEFAULT 'Global',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now()
);

-- =====================================================================
-- 3. CIBLES SURVEILLÉES DE L'INFRASTRUCTURE (Pour les calculs UEBA & Risques)
-- =====================================================================
CREATE TABLE monitored_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL UNIQUE, -- Identifiant unique (ex: 'chloe', 'srv-central')
    target_type target_type_enum NOT NULL,
	email varchar(120) NOT NULL UNIQUE,
	status target_status_enum NOT NULL DEFAULT 'Actif',
    asset_criticality integer NOT NULL CHECK (asset_criticality BETWEEN 1 AND 3),
    global_risk_score integer NOT NULL DEFAULT 0 CHECK (global_risk_score BETWEEN 0 AND 100),
    anomalies_count integer NOT NULL DEFAULT 0,
    last_activity_at timestamp,
    updated_at timestamp DEFAULT now()
);

-- Table pour stocker les profils horaires (UEBA Baselines)
CREATE TABLE ueba_baselines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id uuid NOT NULL REFERENCES monitored_targets(id) ON DELETE CASCADE,
    allowed_start_time time NOT NULL,
    allowed_end_time time NOT NULL,
    normal_daily_volume_mb numeric(10,2) NOT NULL DEFAULT 50.00
);

-- Table MFA temporaire liée aux utilisateurs suivis
CREATE TABLE otp_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id uuid NOT NULL REFERENCES monitored_targets(id) ON DELETE CASCADE,
    otp_code varchar(6) NOT NULL,
    expires_at timestamp NOT NULL,
    is_verified boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now()
);

-- =====================================================================
-- 4. RÈGLES DE CORRÉLATION & PLAYBOOKS SOAR
-- =====================================================================
CREATE TABLE playbooks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action_name varchar(120) NOT NULL UNIQUE, -- ex: 'block_source_ip', 'suspend_user_account'
    description text,
    is_automatic boolean NOT NULL DEFAULT false
);

CREATE TABLE correlation_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code varchar(20) NOT NULL UNIQUE, -- ex: 'RULE-01', 'RULE-02'
    rule_name varchar(120) NOT NULL,
    attack_type attack_type_enum NOT NULL,
    severity_enum severity_enum NOT NULL,
    rule_condition text NOT NULL, -- Description textuelle/JSON de la logique
    playbook_id uuid REFERENCES playbooks(id) ON DELETE SET NULL
);

-- =====================================================================
-- 5. DOSSIERS INCIDENTS & ALERTES CORRÉLÉES
-- =====================================================================
CREATE TABLE incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title varchar(150) NOT NULL,
    description text,
    severity severity_enum NOT NULL,
    status incident_status_enum NOT NULL DEFAULT 'OPEN',
    source_ip inet,
    assigned_to uuid REFERENCES soc_users(id) ON DELETE SET NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    closed_at timestamp
);

CREATE TABLE alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id uuid REFERENCES correlation_rules(id) ON DELETE SET NULL,
    incident_id uuid REFERENCES incidents(id) ON DELETE SET NULL, -- Nullable si orpheline
    target_id uuid REFERENCES monitored_targets(id) ON DELETE CASCADE,
    title varchar(150) NOT NULL,
    attack_type attack_type_enum NOT NULL,
    severity severity_enum NOT NULL,
    score_impact integer NOT NULL, -- Calculé dynamiquement par le moteur : (G x C) x 10
    status incident_status_enum NOT NULL DEFAULT 'OPEN',
    created_at timestamp NOT NULL DEFAULT now()
);

-- La passerelle vers Elasticsearch : associe l'ID de l'alerte SQL aux IDs de documents ES
CREATE TABLE alert_logs (
    id bigserial PRIMARY KEY,
    alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    elastic_log_id varchar(64) NOT NULL, -- L'identifiant unique '_id' généré par Elasticsearch
    CONSTRAINT unique_alert_log UNIQUE (alert_id, elastic_log_id)
);

CREATE TABLE incident_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    playbook_id uuid NOT NULL REFERENCES playbooks(id),
    executed_by uuid REFERENCES soc_users(id) ON DELETE SET NULL, -- NULL si exécution automatique SOAR
    execution_status execution_status_enum NOT NULL DEFAULT 'En attente',
    execution_time timestamp DEFAULT now()
);

-- =====================================================================
-- 6. AUDIT & SUPERVISION DE L'INFRASTRUCTURE
-- =====================================================================
CREATE TABLE cluster_nodes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    node_name varchar(50) NOT NULL,
    node_role varchar(30) NOT NULL CHECK (node_role IN ('data-master', 'data')),
    status varchar(20) NOT NULL DEFAULT 'HEALTHY' CHECK (status IN ('HEALTHY', 'DEGRADED', 'DOWN')),
    last_heartbeat_at timestamp
);

CREATE TABLE storage_status (
    id bigserial PRIMARY KEY,
    recorded_at timestamp NOT NULL DEFAULT now(),
    used_gb numeric(10,2) NOT NULL,
    total_gb numeric(10,2) NOT NULL,
    alert_threshold_pct integer NOT NULL DEFAULT 80
);

CREATE TABLE audit_logs (
    id bigserial PRIMARY KEY,
    occurred_at timestamp NOT NULL DEFAULT now(),
    actor_username varchar(50) NOT NULL,
    action text NOT NULL,
    ip_address inet
);
