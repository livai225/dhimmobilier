-- Mise à jour de la fonction calculate_location_dette pour le bon calcul de dette
CREATE OR REPLACE FUNCTION public.calculate_location_dette()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  total_paye DECIMAL;
  annees_ecoules INTEGER;
  mois_dans_annee_courante INTEGER;
  dette_annuelle DECIMAL;
BEGIN
  -- Calculer le nombre d'années complètes écoulées depuis le début
  annees_ecoules = EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.date_debut));
  
  -- Calculer le nombre de mois dans l'année courante
  mois_dans_annee_courante = EXTRACT(MONTH FROM AGE(CURRENT_DATE, NEW.date_debut));
  
  -- Calculer le montant total payé pour cette location (hors caution initiale)
  SELECT COALESCE(SUM(montant), 0) INTO total_paye
  FROM public.paiements_locations 
  WHERE location_id = NEW.id;
  
  -- Calculer la dette selon l'année
  IF annees_ecoules = 0 THEN
    -- Première année: dette = loyer × 10 (car 2 mois d'avance déjà payés)
    dette_annuelle = NEW.loyer_mensuel * 10;
  ELSE
    -- Années suivantes: dette = (années complètes × loyer × 12) + (mois année courante × loyer)
    dette_annuelle = (annees_ecoules * NEW.loyer_mensuel * 12) + 
                     (NEW.loyer_mensuel * 10) + -- première année toujours 10 mois
                     (mois_dans_annee_courante * NEW.loyer_mensuel); -- mois de l'année courante
  END IF;
  
  -- Calculer la dette restante
  NEW.dette_totale = GREATEST(0, dette_annuelle - total_paye);
  
  RETURN NEW;
END;
$function$;