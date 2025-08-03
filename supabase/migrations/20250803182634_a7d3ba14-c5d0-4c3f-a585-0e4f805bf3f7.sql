-- Migration pour améliorer la structure de la table clients
-- Ajouter les nouveaux champs de téléphone et contact d'urgence

-- Ajouter les nouveaux champs
ALTER TABLE public.clients 
ADD COLUMN telephone_principal text,
ADD COLUMN telephone_secondaire_1 text,
ADD COLUMN telephone_secondaire_2 text,
ADD COLUMN contact_urgence_nom text,
ADD COLUMN contact_urgence_telephone text,
ADD COLUMN contact_urgence_relation text;

-- Migrer les données existantes du champ telephone vers telephone_principal
UPDATE public.clients 
SET telephone_principal = telephone 
WHERE telephone IS NOT NULL;

-- Supprimer l'ancien champ telephone après migration
ALTER TABLE public.clients DROP COLUMN telephone;

-- Ajouter des contraintes de validation pour les formats de téléphone
ALTER TABLE public.clients 
ADD CONSTRAINT valid_telephone_principal 
CHECK (telephone_principal IS NULL OR telephone_principal ~ '^[\+]?[0-9\s\-\(\)]{8,15}$');

ALTER TABLE public.clients 
ADD CONSTRAINT valid_telephone_secondaire_1 
CHECK (telephone_secondaire_1 IS NULL OR telephone_secondaire_1 ~ '^[\+]?[0-9\s\-\(\)]{8,15}$');

ALTER TABLE public.clients 
ADD CONSTRAINT valid_telephone_secondaire_2 
CHECK (telephone_secondaire_2 IS NULL OR telephone_secondaire_2 ~ '^[\+]?[0-9\s\-\(\)]{8,15}$');

ALTER TABLE public.clients 
ADD CONSTRAINT valid_contact_urgence_telephone 
CHECK (contact_urgence_telephone IS NULL OR contact_urgence_telephone ~ '^[\+]?[0-9\s\-\(\)]{8,15}$');

-- Ajouter un commentaire sur la table
COMMENT ON TABLE public.clients IS 'Table des clients avec informations de contact étendues incluant plusieurs numéros de téléphone et contact d''urgence';