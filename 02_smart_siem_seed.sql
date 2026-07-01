-- =====================================================================
-- SMART SIEM — CTU — JEU DE DONNÉES DE DÉMONSTRATION
-- À exécuter après 01_smart_siem_schema.sql
-- Respecte strictement le dictionnaire officiel : seuls les hôtes,
-- event_type, attack_type, severity et statuts définis y sont utilisés.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. INFRASTRUCTURE OFFICIELLE — WEB-01, VPN-01, DB-01, AD-01,
--    ENDPOINT-01 à ENDPOINT-20
-- ---------------------------------------------------------------------

INSERT INTO hosts (hostname, host_type, ip_address, status) VALUES
  ('WEB-01', 'Serveur Web',                        '192.168.1.10', 'Actif'),
  ('VPN-01', 'Serveur VPN',                         '192.168.1.15', 'Actif'),
  ('DB-01',  'Serveur Base de Données',             '192.168.1.20', 'Actif'),
  ('AD-01',  'Serveur Active Directory simulé',     '192.168.1.5',  'Actif');

INSERT INTO hosts (hostname, host_type, ip_address, status)
SELECT
  'ENDPOINT-' || lpad(n::text, 2, '0'),
  'Poste utilisateur',
  ('192.168.2.' || n)::inet,
  'Actif'
FROM generate_series(1, 20) AS n;

-- ---------------------------------------------------------------------
-- 2. COMPTES SOC (RBAC interface admin)
-- ---------------------------------------------------------------------

INSERT INTO users (username, email, password_hash, role, scope, is_active, last_login_at) VALUES
  ('j.martin',  'j.martin@ctu.local',  crypt('changeme1', gen_salt('bf')), 'Admin',    'Global',         true,  now() - interval '25 minutes'),
  ('l.santos',  'l.santos@ctu.local',  crypt('changeme2', gen_salt('bf')), 'Admin',    'Global',         true,  now() - interval '5 minutes'),
  ('jeremy',    'jeremy@ctu.local',    crypt('changeme3', gen_salt('bf')), 'Analyste', 'Prod',           true,  now() - interval '3 hours'),
  ('a.dupont',  'a.dupont@ctu.local',  crypt('changeme4', gen_salt('bf')), 'Analyste', 'Filiale Europe', true,  now() - interval '3 hours'),
  ('m.legrand', 'm.legrand@ctu.local', crypt('changeme5', gen_salt('bf')), 'Lecteur',  'RH',              true,  now() - interval '1 day');

-- Note : crypt()/gen_salt() nécessitent l'extension pgcrypto (déjà activée
-- dans 01_smart_siem_schema.sql).

-- ---------------------------------------------------------------------
-- 3. PLAYBOOKS SOAR
-- ---------------------------------------------------------------------

INSERT INTO playbooks (attack_type, action_name, description, is_automatic) VALUES
  ('BRUTE_FORCE',        'Bloquer IP via Pare-feu',            'Ajoute l''IP source à la liste noire du pare-feu périmétrique.', true),
  ('DATA_EXFILTRATION',  'Bloquer transfert + Alerter RSSI',    'Coupe la session réseau et notifie immédiatement le RSSI.',       true),
  ('LATERAL_MOVEMENT',   'Isoler l''hôte source',                'Place l''hôte en quarantaine réseau (VLAN isolé).',                false),
  ('LOG_TAMPERING',      'Alerter RSSI immédiatement',          'Notification critique + gel des journaux restants.',              true),
  ('ANOMALOUS_LOGIN',    'Notifier utilisateur + MFA challenge','Envoie un challenge MFA et notifie l''utilisateur concerné.',      false);

-- ---------------------------------------------------------------------
-- 4. RÈGLES DE CORRÉLATION (valeurs conformes aux règles officielles)
-- ---------------------------------------------------------------------

INSERT INTO attack_rules (attack_type, rule_name, description, threshold, time_window_seconds, severity, enabled, playbook_id)
SELECT 'BRUTE_FORCE', 'Détection Force Brute', 'Multiples AUTH_FAILED suivis éventuellement d''un AUTH_SUCCESS.', 5, 60, 'HIGH', true, id
FROM playbooks WHERE action_name = 'Bloquer IP via Pare-feu';

INSERT INTO attack_rules (attack_type, rule_name, description, threshold, time_window_seconds, severity, enabled, playbook_id)
SELECT 'DATA_EXFILTRATION', 'Exfiltration de Données', 'Volume anormal de FILE_DOWNLOAD ou FILE_UPLOAD.', 5000, 300, 'CRITICAL', true, id
FROM playbooks WHERE action_name = 'Bloquer transfert + Alerter RSSI';

INSERT INTO attack_rules (attack_type, rule_name, description, threshold, time_window_seconds, severity, enabled, playbook_id)
SELECT 'LATERAL_MOVEMENT', 'Mouvement Latéral', 'Multiples INTERNAL_CONNECTION vers plusieurs machines.', 3, 120, 'HIGH', true, id
FROM playbooks WHERE action_name = 'Isoler l''hôte source';

INSERT INTO attack_rules (attack_type, rule_name, description, threshold, time_window_seconds, severity, enabled, playbook_id)
SELECT 'LOG_TAMPERING', 'Altération des Journaux', 'SERVICE_STOPPED ou LOG_DELETION détecté.', 1, 1, 'CRITICAL', true, id
FROM playbooks WHERE action_name = 'Alerter RSSI immédiatement';

INSERT INTO attack_rules (attack_type, rule_name, description, threshold, time_window_seconds, severity, enabled, playbook_id)
SELECT 'ANOMALOUS_LOGIN', 'Connexion Anormale', 'AUTH_SUCCESS à des horaires anormaux.', 1, 1, 'WARNING', true, id
FROM playbooks WHERE action_name = 'Notifier utilisateur + MFA challenge';

-- ---------------------------------------------------------------------
-- 5. LOGS — un scénario par attaque officielle
-- ---------------------------------------------------------------------

-- 5.1 BRUTE_FORCE sur WEB-01 (compte "jeremy") : 5 AUTH_FAILED en <60s + 1 AUTH_SUCCESS final
INSERT INTO logs ("timestamp", host_id, source_ip, destination_ip, "user", event_type, severity, status, data_volume, raw_message)
SELECT now() - interval '2 hours' + (n * interval '10 seconds'),
       (SELECT id FROM hosts WHERE hostname = 'WEB-01'),
       '203.0.113.47', '192.168.1.10', 'jeremy',
       'AUTH_FAILED', 'WARNING', 'FAILED', 0, 'Invalid password'
FROM generate_series(0, 4) AS n;

INSERT INTO logs ("timestamp", host_id, source_ip, destination_ip, "user", event_type, severity, status, data_volume, raw_message) VALUES
  (now() - interval '2 hours' + interval '55 seconds', (SELECT id FROM hosts WHERE hostname = 'WEB-01'), '203.0.113.47', '192.168.1.10', 'jeremy', 'AUTH_SUCCESS', 'INFO', 'SUCCESS', 0, 'Login successful after retries');

-- 5.2 DATA_EXFILTRATION sur DB-01 (compte "svc_backup") : volume anormal de FILE_DOWNLOAD
INSERT INTO logs ("timestamp", host_id, source_ip, destination_ip, "user", event_type, severity, status, data_volume, raw_message) VALUES
  (now() - interval '3 hours', (SELECT id FROM hosts WHERE hostname = 'DB-01'), '192.168.1.20', '45.33.32.156', 'svc_backup', 'FILE_DOWNLOAD', 'CRITICAL', 'SUCCESS', 6200, 'Export massif base clients'),
  (now() - interval '3 hours' + interval '90 seconds', (SELECT id FROM hosts WHERE hostname = 'DB-01'), '192.168.1.20', '45.33.32.156', 'svc_backup', 'FILE_UPLOAD',   'CRITICAL', 'SUCCESS', 3100, 'Transfert sortant vers hôte externe');

-- 5.3 LATERAL_MOVEMENT depuis ENDPOINT-05 vers plusieurs hôtes internes
INSERT INTO logs ("timestamp", host_id, source_ip, destination_ip, "user", event_type, severity, status, data_volume, raw_message) VALUES
  (now() - interval '4 hours', (SELECT id FROM hosts WHERE hostname = 'ENDPOINT-05'), '192.168.2.5', '192.168.1.10', 'k.ibrahim', 'INTERNAL_CONNECTION', 'HIGH', 'SUCCESS', 0, 'Connexion vers WEB-01'),
  (now() - interval '4 hours' + interval '20 seconds', (SELECT id FROM hosts WHERE hostname = 'ENDPOINT-05'), '192.168.2.5', '192.168.1.20', 'k.ibrahim', 'INTERNAL_CONNECTION', 'HIGH', 'SUCCESS', 0, 'Connexion vers DB-01'),
  (now() - interval '4 hours' + interval '40 seconds', (SELECT id FROM hosts WHERE hostname = 'ENDPOINT-05'), '192.168.2.5', '192.168.1.5',  'k.ibrahim', 'INTERNAL_CONNECTION', 'HIGH', 'SUCCESS', 0, 'Connexion vers AD-01');

-- 5.4 LOG_TAMPERING sur AD-01 : arrêt du service de journalisation
INSERT INTO logs ("timestamp", host_id, source_ip, destination_ip, "user", event_type, severity, status, data_volume, raw_message) VALUES
  (now() - interval '1 day', (SELECT id FROM hosts WHERE hostname = 'AD-01'), '192.168.1.5', NULL, 'svc_backup', 'SERVICE_STOPPED', 'CRITICAL', 'INFO', 0, 'Arrêt du service de journalisation'),
  (now() - interval '1 day' + interval '4 seconds', (SELECT id FROM hosts WHERE hostname = 'AD-01'), '192.168.1.5', NULL, 'svc_backup', 'LOG_DELETION',    'CRITICAL', 'INFO', 0, 'Effacement des journaux locaux');

-- 5.5 ANOMALOUS_LOGIN sur VPN-01 : connexion réussie hors horaires
INSERT INTO logs ("timestamp", host_id, source_ip, destination_ip, "user", event_type, severity, status, data_volume, raw_message) VALUES
  (now() - interval '6 hours', (SELECT id FROM hosts WHERE hostname = 'VPN-01'), '41.214.100.30', '192.168.1.15', 'p.muller', 'VPN_CONNECTION', 'WARNING', 'SUCCESS', 0, 'Connexion VPN hors horaires habituelles'),
  (now() - interval '6 hours' + interval '5 seconds', (SELECT id FROM hosts WHERE hostname = 'VPN-01'), '41.214.100.30', '192.168.1.15', 'p.muller', 'AUTH_SUCCESS',   'WARNING', 'SUCCESS', 0, 'Authentification réussie à horaire inhabituel');

-- 5.6 Bruit "normal" (INFO) pour peupler le volume de logs
INSERT INTO logs ("timestamp", host_id, source_ip, destination_ip, "user", event_type, severity, status, data_volume, raw_message) VALUES
  (now() - interval '8 hours', (SELECT id FROM hosts WHERE hostname = 'ENDPOINT-01'), '192.168.2.1', '192.168.1.10', 'a.dupont', 'AUTH_SUCCESS',  'INFO', 'SUCCESS', 0, 'Connexion matinale'),
  (now() - interval '7 hours', (SELECT id FROM hosts WHERE hostname = 'AD-01'),      '192.168.1.5', NULL,           'j.martin', 'USER_CREATED',  'INFO', 'SUCCESS', 0, 'Création du compte p.novak'),
  (now() - interval '5 hours', (SELECT id FROM hosts WHERE hostname = 'ENDPOINT-12'),'192.168.2.12','192.168.1.10', 'm.legrand','FILE_DOWNLOAD', 'INFO', 'SUCCESS', 12, 'Téléchargement document RH'),
  (now() - interval '3 hours 30 minutes', (SELECT id FROM hosts WHERE hostname = 'AD-01'),      '192.168.1.5', NULL,           'j.martin', 'USER_DISABLED', 'WARNING', 'SUCCESS', 0, 'Désactivation du compte k.ibrahim'),
  (now() - interval '1 hour', (SELECT id FROM hosts WHERE hostname = 'ENDPOINT-08'),'192.168.2.8', NULL,           'p.novak',  'MALWARE_DETECTED','CRITICAL','FAILED', 0, 'Antivirus : cheval de Troie détecté et mis en quarantaine');

-- ---------------------------------------------------------------------
-- 6. ALERTES — une par scénario, rattachées à la règle correspondante
-- ---------------------------------------------------------------------

INSERT INTO alerts (id, rule_id, title, attack_type, severity, confidence_score, description, status, created_at)
SELECT gen_random_uuid(), id, 'Brute Force sur WEB-01 (jeremy)', 'BRUTE_FORCE', 'HIGH', 85,
       '5 échecs de connexion détectés en moins de 60 secondes', 'OPEN', now() - interval '2 hours' + interval '55 seconds'
FROM attack_rules WHERE rule_name = 'Détection Force Brute';

INSERT INTO alerts (id, rule_id, title, attack_type, severity, confidence_score, description, status, created_at)
SELECT gen_random_uuid(), id, 'Exfiltration de données depuis DB-01', 'DATA_EXFILTRATION', 'CRITICAL', 92,
       'Volume de transfert sortant très supérieur au seuil normal (9,3 Go)', 'IN_PROGRESS', now() - interval '3 hours' + interval '90 seconds'
FROM attack_rules WHERE rule_name = 'Exfiltration de Données';

INSERT INTO alerts (id, rule_id, title, attack_type, severity, confidence_score, description, status, created_at)
SELECT gen_random_uuid(), id, 'Mouvement latéral depuis ENDPOINT-05', 'LATERAL_MOVEMENT', 'HIGH', 78,
       'Connexions internes vers 3 hôtes distincts en moins de 2 minutes', 'OPEN', now() - interval '4 hours' + interval '40 seconds'
FROM attack_rules WHERE rule_name = 'Mouvement Latéral';

INSERT INTO alerts (id, rule_id, title, attack_type, severity, confidence_score, description, status, created_at)
SELECT gen_random_uuid(), id, 'Altération des journaux sur AD-01', 'LOG_TAMPERING', 'CRITICAL', 97,
       'Arrêt du service de journalisation suivi d''une suppression de logs', 'RESOLVED', now() - interval '1 day' + interval '4 seconds'
FROM attack_rules WHERE rule_name = 'Altération des Journaux';

INSERT INTO alerts (id, rule_id, title, attack_type, severity, confidence_score, description, status, created_at)
SELECT gen_random_uuid(), id, 'Connexion VPN hors horaires (p.muller)', 'ANOMALOUS_LOGIN', 'WARNING', 61,
       'Authentification réussie hors plage habituelle (06h-22h)', 'RESOLVED', now() - interval '6 hours' + interval '5 seconds'
FROM attack_rules WHERE rule_name = 'Connexion Anormale';

-- Rattachement des logs aux alertes correspondantes
INSERT INTO alert_logs (alert_id, log_id)
SELECT a.id, l.id FROM alerts a, logs l
WHERE a.title = 'Brute Force sur WEB-01 (jeremy)' AND l."user" = 'jeremy' AND l.event_type IN ('AUTH_FAILED','AUTH_SUCCESS');

INSERT INTO alert_logs (alert_id, log_id)
SELECT a.id, l.id FROM alerts a, logs l
WHERE a.title = 'Exfiltration de données depuis DB-01' AND l."user" = 'svc_backup' AND l.event_type IN ('FILE_DOWNLOAD','FILE_UPLOAD');

INSERT INTO alert_logs (alert_id, log_id)
SELECT a.id, l.id FROM alerts a, logs l
WHERE a.title = 'Mouvement latéral depuis ENDPOINT-05' AND l."user" = 'k.ibrahim';

INSERT INTO alert_logs (alert_id, log_id)
SELECT a.id, l.id FROM alerts a, logs l
WHERE a.title = 'Altération des journaux sur AD-01' AND l.event_type IN ('SERVICE_STOPPED','LOG_DELETION');

INSERT INTO alert_logs (alert_id, log_id)
SELECT a.id, l.id FROM alerts a, logs l
WHERE a.title = 'Connexion VPN hors horaires (p.muller)' AND l."user" = 'p.muller';

-- ---------------------------------------------------------------------
-- 7. INCIDENTS (statuts strictement OPEN / IN_PROGRESS / RESOLVED / CLOSED)
-- ---------------------------------------------------------------------

INSERT INTO incidents (alert_id, title, description, severity, status, source_ip, target, assigned_to, created_at, updated_at)
SELECT a.id, 'Suspicion Brute Force — admin_prod', 'Investigation suite à 5 échecs d''authentification consécutifs.',
       'HIGH', 'OPEN', '203.0.113.47', 'jeremy@WEB-01',
       (SELECT id FROM users WHERE username = 'jeremy'), a.created_at, a.created_at
FROM alerts a WHERE a.title = 'Brute Force sur WEB-01 (jeremy)';

INSERT INTO incidents (alert_id, title, description, severity, status, source_ip, target, assigned_to, created_at, updated_at)
SELECT a.id, 'Exfiltration de données confirmée', 'Transfert massif vers IP externe non référencée.',
       'CRITICAL', 'IN_PROGRESS', '192.168.1.20', 'svc_backup@DB-01',
       (SELECT id FROM users WHERE username = 'l.santos'), a.created_at, now() - interval '2 hours'
FROM alerts a WHERE a.title = 'Exfiltration de données depuis DB-01';

INSERT INTO incidents (alert_id, title, description, severity, status, source_ip, target, assigned_to, created_at, updated_at)
SELECT a.id, 'Propagation interne suspecte', 'Reconnaissance réseau probable depuis un poste utilisateur compromis.',
       'HIGH', 'OPEN', '192.168.2.5', 'Réseau interne 192.168.1.0/24',
       NULL, a.created_at, a.created_at
FROM alerts a WHERE a.title = 'Mouvement latéral depuis ENDPOINT-05';

INSERT INTO incidents (alert_id, title, description, severity, status, source_ip, target, assigned_to, created_at, updated_at, closed_at)
SELECT a.id, 'Tentative d''effacement de traces sur AD-01', 'Service de journalisation coupé puis logs supprimés.',
       'CRITICAL', 'CLOSED', '192.168.1.5', 'AD-01',
       (SELECT id FROM users WHERE username = 'j.martin'), a.created_at, now() - interval '1 day', now() - interval '1 day'
FROM alerts a WHERE a.title = 'Altération des journaux sur AD-01';

INSERT INTO incidents (alert_id, title, description, severity, status, source_ip, target, assigned_to, created_at, updated_at, closed_at)
SELECT a.id, 'Connexion hors horaires — p.muller', 'Vérifié auprès de l''utilisateur : déplacement professionnel légitime.',
       'WARNING', 'RESOLVED', '41.214.100.30', 'p.muller@VPN-01',
       (SELECT id FROM users WHERE username = 'a.dupont'), a.created_at, now() - interval '6 hours', now() - interval '6 hours'
FROM alerts a WHERE a.title = 'Connexion VPN hors horaires (p.muller)';

-- ---------------------------------------------------------------------
-- 8. ACTIONS DE REMÉDIATION EXÉCUTÉES
-- ---------------------------------------------------------------------

INSERT INTO incident_actions (incident_id, playbook_id, executed_by, execution_status, execution_time)
SELECT i.id, p.id, (SELECT id FROM users WHERE username = 'j.martin'), 'Succès', now() - interval '1 day'
FROM incidents i, playbooks p
WHERE i.title = 'Tentative d''effacement de traces sur AD-01' AND p.action_name = 'Alerter RSSI immédiatement';

INSERT INTO incident_actions (incident_id, playbook_id, executed_by, execution_status, execution_time)
SELECT i.id, p.id, NULL, 'Succès', i.created_at + interval '1 minute'
FROM incidents i, playbooks p
WHERE i.title = 'Suspicion Brute Force — admin_prod' AND p.action_name = 'Bloquer IP via Pare-feu';

INSERT INTO incident_actions (incident_id, playbook_id, executed_by, execution_status, execution_time)
SELECT i.id, p.id, (SELECT id FROM users WHERE username = 'l.santos'), 'En attente', NULL
FROM incidents i, playbooks p
WHERE i.title = 'Exfiltration de données confirmée' AND p.action_name = 'Bloquer transfert + Alerter RSSI';

-- ---------------------------------------------------------------------
-- 9. SUPERVISION INFRASTRUCTURE
-- ---------------------------------------------------------------------

INSERT INTO cluster_nodes (node_name, node_role, status, last_heartbeat_at) VALUES
  ('node-01', 'data-master', 'HEALTHY', now() - interval '5 seconds'),
  ('node-02', 'data',        'HEALTHY', now() - interval '3 seconds'),
  ('node-03', 'data',        'HEALTHY', now() - interval '4 seconds');

INSERT INTO ingestion_metrics (recorded_at, logs_per_second)
SELECT now() - (n || ' minutes')::interval, 1500 + (random() * 1500)::int
FROM generate_series(0, 9) AS n;

INSERT INTO storage_status (recorded_at, used_gb, total_gb, alert_threshold_pct) VALUES
  (now(), 4500.00, 10000.00, 80);

INSERT INTO retention_policies (retention_days, sealed, sealed_at, sealed_by) VALUES
  (365, true, now() - interval '10 days', (SELECT id FROM users WHERE username = 'j.martin'));

INSERT INTO audit_log (occurred_at, actor_username, action, ip_address) VALUES
  (now() - interval '2 minutes',  'l.santos', 'Connexion réussie depuis session CLI',                          '10.0.1.45'),
  (now() - interval '9 minutes',  'j.martin', 'Modification du rôle de k.ibrahim → Inactif',                   '10.0.1.12'),
  (now() - interval '3 hours',    'j.martin', 'Création règle : "Connexion Hors Horaires"',                    '10.0.1.12'),
  (now() - interval '1 day',      'j.martin', 'Modification politique de rétention → 365 jours',               '10.0.1.12'),
  (now() - interval '1 day 2 hours', 'SYSTEM', 'Purge automatique des logs > 365j (148 Go libérés)',           '127.0.0.1');

-- ---------------------------------------------------------------------
-- 10. UEBA — scores de risque comportemental
-- ---------------------------------------------------------------------

INSERT INTO user_risk_scores (user_id, risk_score, anomalies_count, delta_24h, last_activity_at, summary)
SELECT id, 12, 0, 0, now() - interval '4 hours', 'Aucune anomalie détectée — comportement nominal'
FROM users WHERE username = 'a.dupont';

INSERT INTO user_risk_scores (user_id, risk_score, anomalies_count, delta_24h, last_activity_at, summary)
SELECT id, 38, 2, 5, now() - interval '10 hours', 'Connexion depuis pays non référencé'
FROM users WHERE username = 'm.legrand';

INSERT INTO user_risk_scores (user_id, risk_score, anomalies_count, delta_24h, last_activity_at, summary)
SELECT id, 72, 6, 18, now() - interval '2 hours', 'Multiples AUTH_FAILED puis AUTH_SUCCESS — IP externe suspecte'
FROM users WHERE username = 'jeremy';

INSERT INTO anomalies (user_id, anomaly_type, description, detected_at, risk_contribution)
SELECT id, 'ANOMALOUS_LOGIN', 'Connexion VPN hors horaires', now() - interval '6 hours', 14
FROM users WHERE username = 'm.legrand';
