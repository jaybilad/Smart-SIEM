-- =====================================================================
-- 1. INSERTION DES COMPTES OPÉRATEURS SOC (RBAC)
-- Le mot de passe hashé fourni ici est un exemple générique en SHA-256
-- =====================================================================
INSERT INTO soc_users (username, email, password_hash, role, scope, is_active) VALUES
('chloe.obrian', 'chloe.obrian@ctu.gov', encode(digest('JackBauer123!', 'sha256'), 'hex'), 'Admin', 'Global', true),
('edgar.stiles', 'edgar.stiles@ctu.gov', encode(digest('SOCAnalyst2026!', 'sha256'), 'hex'), 'Analyste', 'Reseau_Interne', true),
('analyste.junior', 'junior@ctu.gov', encode(digest('JuniorSOC!', 'sha256'), 'hex'), 'Lecteur', 'Frontiere', true);

-- =====================================================================
-- 2. INSERTION DES CIBLES SURVEILLÉES DE L'INFRASTRUCTURE (CTU Assets)
-- Celles-ci possèdent leurs criticités (1 à 3) selon leur importance
-- =====================================================================
INSERT INTO monitored_targets (name, target_type, email, asset_criticality, global_risk_score, anomalies_count, last_activity_at) VALUES
-- Utilisateurs sensibles (Humains)
('jack.bauer', 'USER', 'jack.bauer@ctu.gov', 3, 0, 0, now()),
('tony.almeida', 'USER', 'tony.almeida@ctu.gov', 2, 0, 0, now()),
('nina.myers', 'USER', 'nina.myers@ctu.gov', 3, 0, 0, now()),
('agent.secrétariat', 'USER', 'agent.secrétariat@ctu.gov', 1, 0, 0, now()),

-- Machines et Serveurs de l'infrastructure
('srv-central', 'HOST', 'srv-central@ctu.gov', 3, 0, 0, now()),
('srv-db', 'HOST', 'srv-db@ctu.gov', 3, 0, 0, now()),
('fw-principal', 'HOST', 'fw-principal@ctu.gov', 3, 0, 0, now()),
('vpn-gateway', 'HOST', 'vpn-gateway@ctu.gov', 2, 0, 0, now()),
('endpoint-chloe', 'HOST', 'endpoint-chloe@ctu.gov', 2, 0, 0, now()),
('endpoint-test', 'HOST', 'endpoint-test@ctu.gov', 1, 0, 0, now());

-- =====================================================================
-- 3. INSERTION DES BASELINES UEBA DES UTILISATEURS
-- Plages horaires et volumes de données normaux calculés historiquement
-- =====================================================================
INSERT INTO ueba_baselines (target_id, allowed_start_time, allowed_end_time, normal_daily_volume_mb) VALUES
((SELECT id FROM monitored_targets WHERE name = 'jack.bauer'), '06:00:00', '23:59:59', 250.00),
((SELECT id FROM monitored_targets WHERE name = 'tony.almeida'), '08:00:00', '19:00:00', 100.00),
((SELECT id FROM monitored_targets WHERE name = 'nina.myers'), '08:00:00', '18:00:00', 80.00),
((SELECT id FROM monitored_targets WHERE name = 'agent.secrétariat'), '09:00:00', '17:00:00', 20.00);

-- =====================================================================
-- 4. INSERTION DES PLAYBOOKS SOAR (Catalogue d'actions de remédiation)
-- =====================================================================
INSERT INTO playbooks (action_name, description, is_automatic) VALUES
('block_source_ip', 'Bannit temporairement l IP source attaquante sur le pare-feu périmétrique.', true),
('isolate_machine', 'Isole le host compromis du réseau local via un switch virtuel ou le pare-feu.', false),
('suspend_user_account', 'Verrouille le compte utilisateur dans l Active Directory et tue ses sessions actives.', true),
('notify_analyst_slack', 'Envoie une alerte enrichie contenant les logs sur le canal Slack de l équipe SOC.', false),
('trigger_mfa_challenge', 'Force l envoi d un code OTP par mail/SMS et bloque l accès tant qu il n est pas soumis.', false);

-- =====================================================================
-- 5. INSERTION DES RÈGLES DE CORRÉLATION TECHNIQUES (RULE-01 à RULE-07)
-- Rattachement direct à l'ID de leur Playbook SOAR respectif
-- =====================================================================
INSERT INTO correlation_rules (rule_code, rule_name, attack_type, severity_enum, rule_condition, playbook_id) VALUES
('RULE-01', 'Brute Force Detection', 'BRUTE_FORCE', 'WARNING', 
 '{"threshold": 5, "time_window_seconds": 60, "event_type": "AUTH_FAILED"}', 
 (SELECT id FROM playbooks WHERE action_name = 'block_source_ip')),

('RULE-02', 'Pass-the-Hash Movement', 'LATERAL_MOVEMENT', 'HIGH', 
 '{"pattern": ["AUTH_SUCCESS_HOST_A", "AUTH_SUCCESS_ADMIN_HOST_B"], "time_window_seconds": 300}', 
 (SELECT id FROM playbooks WHERE action_name = 'isolate_machine')),

('RULE-03', 'Massive Data Exfiltration', 'DATA_EXFILTRATION', 'HIGH', 
 '{"condition": "volume_sent > 10 * baseline_15min"}', 
 (SELECT id FROM playbooks WHERE action_name = 'suspend_user_account')),

('RULE-05', 'Horizontal Network Scanning', 'NETWORK_SCANNING', 'INFO', 
 '{"unique_ports_threshold": 10, "time_window_seconds": 10}', 
 (SELECT id FROM playbooks WHERE action_name = 'notify_analyst_slack')),

('RULE-07', 'Anomalous Connection Hours', 'ANOMALOUS_LOGIN', 'INFO', 
 '{"condition": "timestamp OUTSIDE ueba_baselines.allowed_hours"}', 
 (SELECT id FROM playbooks WHERE action_name = 'trigger_mfa_challenge'));

-- =====================================================================
-- 6. INSERTION INITIALE POUR LA SUPERVISION DES NŒUDS INFRASTRUCTURE
-- Simule l'état de démarrage des clusters Elasticsearch du SIEM
-- =====================================================================
INSERT INTO cluster_nodes (node_name, node_role, status, last_heartbeat_at) VALUES
('es-master-01', 'data-master', 'HEALTHY', now()),
('es-data-01', 'data', 'HEALTHY', now()),
('es-data-02', 'data', 'HEALTHY', now());

-- Initialisation de la première ligne de statut du stockage (ex: 20 Go utilisés sur 100 Go)
INSERT INTO storage_status (recorded_at, used_gb, total_gb, alert_threshold_pct) VALUES
(now(), 20.50, 100.00, 80);

-- Journalisation d'audit initiale pour acter le déploiement
INSERT INTO audit_logs (occurred_at, actor_username, action, ip_address) VALUES
(now(), 'SYSTEM', 'Initialisation de la base de données PostgreSQL du SMART SIEM et chargement des profils CTU.', '127.0.0.1');