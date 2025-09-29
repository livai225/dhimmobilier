-- Étape 1: Modifier la fonction calculate_souscription_dates pour copier montant_mensuel
CREATE OR REPLACE FUNCTION public.calculate_souscription_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate end of finishing period
  IF NEW.type_souscription = 'mise_en_garde' AND NEW.date_debut IS NOT NULL THEN
    NEW.date_fin_finition = NEW.date_debut + (NEW.periode_finition_mois || ' months')::INTERVAL;
    NEW.date_debut_droit_terre = NEW.date_fin_finition + INTERVAL '1 day';
  END IF;
  
  -- CORRECTION: Copier montant_mensuel vers montant_droit_terre_mensuel
  -- Ne plus chercher dans bareme_droits_terre
  IF NEW.montant_mensuel IS NOT NULL AND NEW.montant_mensuel > 0 THEN
    NEW.montant_droit_terre_mensuel = NEW.montant_mensuel;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Étape 2: Corriger TOUTES les données existantes (NULL et celles écrasées par le barème)
UPDATE public.souscriptions
SET montant_droit_terre_mensuel = montant_mensuel,
    updated_at = now()
WHERE phase_actuelle = 'droit_terre'
  AND montant_mensuel IS NOT NULL
  AND montant_mensuel > 0
  AND (
    montant_droit_terre_mensuel IS NULL 
    OR montant_droit_terre_mensuel != montant_mensuel
  );