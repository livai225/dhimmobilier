-- Réinitialisation complète du solde entreprise
-- Supprime TOUS les paiements et reçus pour repartir à zéro

-- Étape 1: Supprimer tous les paiements
DELETE FROM public.paiements_locations;
DELETE FROM public.paiements_souscriptions;
DELETE FROM public.paiements_droit_terre;
DELETE FROM public.paiements_factures;

-- Étape 2: Supprimer tous les reçus et compteurs
DELETE FROM public.recus;
DELETE FROM public.receipt_counters;

-- Étape 3: Supprimer toutes les transactions de caisse
DELETE FROM public.cash_transactions;

-- Étape 4: Remettre à zéro le solde de caisse
UPDATE public.caisse_balance 
SET solde_courant = 0,
    derniere_maj = now(),
    updated_at = now();

-- Étape 5: Supprimer toutes les échéances générées
DELETE FROM public.echeances_droit_terre;

-- Étape 6: Réinitialiser les soldes dans les contrats
-- Pour les locations: remettre dette_totale à 0
UPDATE public.locations 
SET dette_totale = 0,
    updated_at = now();

-- Pour les souscriptions: remettre solde_restant au montant total à payer
UPDATE public.souscriptions 
SET solde_restant = prix_total,
    updated_at = now();