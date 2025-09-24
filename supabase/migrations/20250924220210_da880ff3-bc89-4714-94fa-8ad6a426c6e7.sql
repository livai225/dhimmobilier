-- Suppression des données DH-YVETTE
-- Étape 1: Supprimer les reçus liés
DELETE FROM recus WHERE id = 'f8c3cf4b-f0a8-494b-881f-18fd7bc06670';

-- Étape 2: Supprimer les paiements de location
DELETE FROM paiements_locations WHERE id = '4e0050a1-6c44-4b50-a207-1d58cfc4eee2';

-- Étape 3: Supprimer les locations
DELETE FROM locations WHERE id = '20b8ea9c-87b2-4c6c-a01d-95e3d9412ae6';

-- Étape 4: Supprimer les souscriptions
DELETE FROM souscriptions WHERE id = 'f6f328f0-f0cb-4150-8a16-319943de6c44';

-- Vérification: Afficher le nombre d'enregistrements supprimés par table
SELECT 
    'recus' as table_name,
    COUNT(*) as remaining_count
FROM recus 
WHERE client_id IN ('52cea27b-399a-43cc-9b78-76119771dcc7', 'ee6777fb-9f29-4b42-833b-a6633f468d8b')

UNION ALL

SELECT 
    'paiements_locations' as table_name,
    COUNT(*) as remaining_count
FROM paiements_locations pl
JOIN locations l ON pl.location_id = l.id
WHERE l.client_id IN ('52cea27b-399a-43cc-9b78-76119771dcc7', 'ee6777fb-9f29-4b42-833b-a6633f468d8b')

UNION ALL

SELECT 
    'locations' as table_name,
    COUNT(*) as remaining_count
FROM locations 
WHERE client_id IN ('52cea27b-399a-43cc-9b78-76119771dcc7', 'ee6777fb-9f29-4b42-833b-a6633f468d8b')

UNION ALL

SELECT 
    'souscriptions' as table_name,
    COUNT(*) as remaining_count
FROM souscriptions 
WHERE client_id IN ('52cea27b-399a-43cc-9b78-76119771dcc7', 'ee6777fb-9f29-4b42-833b-a6633f468d8b');