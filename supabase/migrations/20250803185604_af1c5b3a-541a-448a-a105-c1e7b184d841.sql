-- Phase 1: Extension de la base de données pour le module Propriétés professionnel
-- Ajouter les nouveaux champs à la table proprietes

-- Ajouter les nouveaux champs
ALTER TABLE public.proprietes 
ADD COLUMN statut TEXT DEFAULT 'Libre' CHECK (statut IN ('Libre', 'Occupé', 'En travaux', 'En vente')),
ADD COLUMN zone TEXT,
ADD COLUMN usage TEXT DEFAULT 'Location' CHECK (usage IN ('Location', 'Bail')),
ADD COLUMN loyer_mensuel NUMERIC DEFAULT 0,
ADD COLUMN montant_bail NUMERIC DEFAULT 0,
ADD COLUMN droit_terre NUMERIC DEFAULT 0;

-- Créer des index pour améliorer les performances des requêtes
CREATE INDEX idx_proprietes_statut ON public.proprietes(statut);
CREATE INDEX idx_proprietes_usage ON public.proprietes(usage);
CREATE INDEX idx_proprietes_zone ON public.proprietes(zone);

-- Ajouter des commentaires pour documenter les colonnes
COMMENT ON COLUMN public.proprietes.statut IS 'Statut de la propriété: Libre, Occupé, En travaux, En vente';
COMMENT ON COLUMN public.proprietes.zone IS 'Zone géographique de la propriété';
COMMENT ON COLUMN public.proprietes.usage IS 'Type d''usage: Location ou Bail';
COMMENT ON COLUMN public.proprietes.loyer_mensuel IS 'Loyer mensuel pour les locations';
COMMENT ON COLUMN public.proprietes.montant_bail IS 'Montant du bail pour les souscriptions';
COMMENT ON COLUMN public.proprietes.droit_terre IS 'Droit de terre pour les baux';