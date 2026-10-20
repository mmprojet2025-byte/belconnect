-- Local profile only. Fictional projects for checking the public catalogue.
-- Keep the demo owner disabled so no seeded account can sign in.
INSERT INTO utilisateur (email, mot_de_passe_hash, nom, statut)
VALUES ('belconnect-demo-projects@example.invalid', 'disabled-demo-account', 'Belconnect Démo', 'DESACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO espace_organisateur (nom, type, statut, createur_id, description)
SELECT 'Belconnect Démo', 'ASSOCIATION', 'ACTIF', u.id,
       'Espace fictif réservé aux exemples locaux de Belconnect.'
FROM utilisateur u
WHERE u.email = 'belconnect-demo-projects@example.invalid'
  AND NOT EXISTS (
    SELECT 1 FROM espace_organisateur e
    WHERE e.nom = 'Belconnect Démo' AND e.createur_id = u.id
  );

WITH exemples (creation_request, titre, description, objectif, debut_prevu, fin_prevue, types_aide) AS (
  VALUES
    ('1c18f154-1fa1-435b-995e-7ffef93b0901'::uuid,
     '[Démo] Jardin partagé du quartier',
     'Exemple fictif : des voisins aménagent un jardin partagé. La participation bénévole est gratuite ; un don libre peut aider à acheter graines et outils.',
     'Créer un espace vert ouvert aux habitants et organiser les premiers ateliers de jardinage.',
     '2026-11-07'::date, '2027-03-31'::date, ARRAY['BENEVOLAT','PARTAGE']::text[]),
    ('1c18f154-1fa1-435b-995e-7ffef93b0902'::uuid,
     '[Démo] Accès numérique pour tous',
     'Exemple fictif : des bénévoles aident les habitants à utiliser les outils numériques. Six ateliers à 12 € la place financent aussi des places solidaires ; un don libre soutient le projet.',
     'Rendre le numérique accessible aux habitants du quartier, notamment aux personnes qui n’ont pas d’aide à proximité.',
     '2026-11-14'::date, '2027-02-28'::date, ARRAY['COMPETENCES','BENEVOLAT']::text[]),
    ('1c18f154-1fa1-435b-995e-7ffef93b0903'::uuid,
     '[Démo] Boîtes à livres solidaires',
     'Exemple fictif : fabriquer et installer des boîtes à livres de quartier. L’aide en bricolage ou en collecte de livres est gratuite ; les dons libres couvrent les matériaux.',
     'Installer trois boîtes à livres et organiser leur entretien collectif.',
     '2026-11-21'::date, '2027-04-30'::date, ARRAY['COMPETENCES','PARTAGE']::text[]),
    ('1c18f154-1fa1-435b-995e-7ffef93b0904'::uuid,
     '[Démo] Mémoire vivante du quartier',
     'Exemple fictif : des habitants recueillent les témoignages et les photos de leur quartier. Quatre balades à 18 € la place contribuent au financement ; un don libre aide à documenter les récits.',
     'Créer une archive locale ouverte à tous pour conserver et partager les histoires du quartier.',
     '2026-12-05'::date, '2027-05-31'::date, ARRAY['PARTAGE','COMPETENCES']::text[])
)
INSERT INTO projet (espace_id, auteur_id, creation_request, titre, description,
                    objectif, statut, visibilite, debut_prevu, fin_prevue,
                    publie, date_publication, types_aide)
SELECT e.id, u.id, x.creation_request, x.titre, x.description,
       x.objectif, 'APPROUVE', 'PUBLIQUE', x.debut_prevu, x.fin_prevue,
       true, now(), x.types_aide
FROM exemples x
JOIN utilisateur u ON u.email = 'belconnect-demo-projects@example.invalid'
JOIN espace_organisateur e ON e.createur_id = u.id AND e.nom = 'Belconnect Démo'
ON CONFLICT (auteur_id, creation_request) DO NOTHING;

-- Refresh only the two fictional examples that previously looked like single events.
UPDATE projet p SET titre = x.titre, description = x.description, objectif = x.objectif
FROM (VALUES
  ('1c18f154-1fa1-435b-995e-7ffef93b0902'::uuid,
   '[Démo] Accès numérique pour tous',
   'Exemple fictif : des bénévoles aident les habitants à utiliser les outils numériques. Six ateliers à 12 € la place financent aussi des places solidaires ; un don libre soutient le projet.',
   'Rendre le numérique accessible aux habitants du quartier, notamment aux personnes qui n’ont pas d’aide à proximité.'),
  ('1c18f154-1fa1-435b-995e-7ffef93b0904'::uuid,
   '[Démo] Mémoire vivante du quartier',
   'Exemple fictif : des habitants recueillent les témoignages et les photos de leur quartier. Quatre balades à 18 € la place contribuent au financement ; un don libre aide à documenter les récits.',
   'Créer une archive locale ouverte à tous pour conserver et partager les histoires du quartier.')
) AS x(creation_request, titre, description, objectif)
WHERE p.creation_request = x.creation_request;

-- Images are stored in the frontend's local public assets. Preserve images changed by hand.
UPDATE projet p SET image_url = CASE p.creation_request
  WHEN '1c18f154-1fa1-435b-995e-7ffef93b0901'::uuid THEN '/images/projet-jardin.jpg'
  WHEN '1c18f154-1fa1-435b-995e-7ffef93b0902'::uuid THEN '/images/projet-numerique.jpg'
  WHEN '1c18f154-1fa1-435b-995e-7ffef93b0903'::uuid THEN '/images/projet-livres.jpg'
  WHEN '1c18f154-1fa1-435b-995e-7ffef93b0904'::uuid THEN '/images/projet-patrimoine.jpg'
  ELSE p.image_url END
FROM utilisateur u
WHERE p.auteur_id = u.id AND u.email = 'belconnect-demo-projects@example.invalid'
  AND p.creation_request IN (
    '1c18f154-1fa1-435b-995e-7ffef93b0901'::uuid,
    '1c18f154-1fa1-435b-995e-7ffef93b0902'::uuid,
    '1c18f154-1fa1-435b-995e-7ffef93b0903'::uuid,
    '1c18f154-1fa1-435b-995e-7ffef93b0904'::uuid
  ) AND p.image_url IS NULL;

INSERT INTO offre_participation_projet (projet_id, description, prix_centimes, capacite)
SELECT p.id, 'Une place pour un atelier numérique en petit groupe, au bénéfice du projet.', 1200, 16
FROM projet p
WHERE p.creation_request = '1c18f154-1fa1-435b-995e-7ffef93b0902'::uuid
ON CONFLICT (projet_id) DO NOTHING;

INSERT INTO offre_participation_projet (projet_id, description, prix_centimes, capacite)
SELECT p.id, 'Une place pour une balade guidée qui soutient la collecte des récits du quartier.', 1800, 24
FROM projet p
WHERE p.creation_request = '1c18f154-1fa1-435b-995e-7ffef93b0904'::uuid
ON CONFLICT (projet_id) DO NOTHING;
