import psycopg

conn = psycopg.connect('postgresql://postgres:admin@localhost:5432/smart')
cur = conn.cursor(row_factory=psycopg.rows.dict_row)
queries = [
    "SELECT COUNT(*) FILTER (WHERE status IN ('OPEN', 'IN_PROGRESS')) AS active, COUNT(*) FILTER (WHERE status IN ('OPEN', 'IN_PROGRESS') AND severity = 'CRITICAL') AS critical FROM incidents",
    "SELECT COUNT(*) AS cnt FROM alerts WHERE created_at >= now() - interval '24 hours'",
    "SELECT logs_per_second FROM ingestion_metrics ORDER BY recorded_at DESC LIMIT 1",
    "SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(closed_at, updated_at) - created_at)) / 60) AS mttr FROM incidents WHERE status IN ('RESOLVED', 'CLOSED') AND COALESCE(closed_at, updated_at) IS NOT NULL",
    "SELECT severity, COUNT(*) AS count FROM incidents WHERE status IN ('OPEN', 'IN_PROGRESS') GROUP BY severity",
    "SELECT i.*, u.username AS assignee FROM incidents i LEFT JOIN users u ON u.id = i.assigned_to ORDER BY i.created_at DESC LIMIT 5"
]
for q in queries:
    try:
        cur.execute(q)
        print('OK')
        print(cur.fetchone())
    except Exception as e:
        print('ERR', type(e).__name__, e)
conn.close()
