-- =====================================================================
-- 1. COMPTES DES OPÉRATEURS SOC (RBAC)
-- =====================================================================
-- Pour lister tous les analystes et administrateurs du SIEM
SELECT * FROM soc_users;

-- =====================================================================
-- 2. CIBLES SURVEILLÉES DE L'INFRASTRUCTURE (CTU Assets & UEBA)
-- =====================================================================
-- Pour voir la liste des machines/agents et leurs scores de risques globaux
SELECT * FROM monitored_targets;

-- Pour voir les plages horaires de confiance et volumes baselines définis
SELECT * FROM ueba_baselines;

-- Pour surveiller les codes MFA temporaires générés par le SOAR
SELECT * FROM otp_verifications;

-- =====================================================================
-- 3. RÈGLES DE CORRÉLATION & PLAYBOOKS SOAR
-- =====================================================================
-- Pour lister toutes les actions automatiques ou manuelles du SOAR
SELECT * FROM playbooks;

-- Pour lister les 5 règles techniques (RULE-01 à RULE-07) et leurs critères
SELECT * FROM correlation_rules;

-- =====================================================================
-- 4. DOSSIERS INCIDENTS & ALERTES CORRÉLÉES
-- =====================================================================
-- Pour voir tous les tickets d'incidents ouverts, en cours ou fermés
SELECT * FROM incidents;

-- Pour lister toutes les alertes déclenchées par le moteur
SELECT * FROM alerts;

-- Pour voir la table pivot reliant les alertes SQL aux IDs de logs Elasticsearch
SELECT * FROM alert_logs;

-- Pour auditer l'historique et le statut des actions lancées par le SOAR
SELECT * FROM incident_actions;

-- =====================================================================
-- 5. AUDIT & SUPERVISION DE L'INFRASTRUCTURE
-- =====================================================================
-- Pour voir l'état de santé en temps réel de tes nœuds de données
SELECT * FROM cluster_nodes;

-- Pour voir l'historique de la consommation d'espace disque (jauge UI)
SELECT * FROM storage_status;

-- Pour voir la piste d'audit immuable des actions des administrateurs
SELECT * FROM audit_logs;

SELECT id, asset_criticality, global_risk_score 
FROM monitored_targets 
WHERE name = 'chloe' AND target_type = 'USER';

SELECT allowed_start_time, allowed_end_time 
FROM ueba_baselines 
WHERE target_id = (SELECT id FROM monitored_targets WHERE name = 'nina.myers');

SELECT i.id, i.title, i.severity, i.status, i.created_at, t.name AS target_name
FROM incidents i
JOIN alerts a ON a.incident_id = i.id
JOIN monitored_targets t ON a.target_id = t.id
WHERE t.name IN ('srv-central', 'srv-db', 'fw-principal') -- Les hosts de ce périmètre
ORDER BY i.created_at DESC;

SELECT id, title, attack_type, severity, score_impact, created_at 
FROM alerts 
WHERE incident_id = 'METTRE_L_UUID_DE_L_INCIDENT_ICI';

SELECT elastic_log_id 
FROM alert_logs 
WHERE alert_id = 'METTRE_L_UUID_DE_L_ALERTE_ICI';

-- Récupérer l'état des nœuds
SELECT node_name, node_role, status, last_heartbeat_at 
FROM cluster_nodes;

-- Récupérer le dernier enregistrement du stockage disque
SELECT used_gb, total_gb, alert_threshold_pct, recorded_at 
FROM storage_status 
ORDER BY recorded_at DESC 
LIMIT 1;

SELECT id, username, email, role, scope, is_active, created_at 
FROM soc_users 
ORDER BY username ASC;
