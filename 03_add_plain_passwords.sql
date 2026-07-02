-- Upgrade pour les bases deja initialisees.
-- Ajoute les mots de passe en clair demandes pour la demo de connexion.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_plain varchar(255);

UPDATE users
SET password_plain = CASE username
  WHEN 'j.martin' THEN 'changeme1'
  WHEN 'l.santos' THEN 'changeme2'
  WHEN 'jeremy' THEN 'changeme3'
  WHEN 'a.dupont' THEN 'changeme4'
  WHEN 'm.legrand' THEN 'changeme5'
  ELSE password_plain
END
WHERE username IN ('j.martin', 'l.santos', 'jeremy', 'a.dupont', 'm.legrand');
