-- Mise à jour de toutes les locations existantes pour recalculer la dette
-- avec la nouvelle logique (10 mois première année, 12 mois années suivantes)

DO $$
DECLARE
  location_record RECORD;
  total_paye DECIMAL;
  annees_ecoules INTEGER;
  mois_dans_annee_courante INTEGER;
  dette_annuelle DECIMAL;
  nouvelle_dette DECIMAL;
BEGIN
  -- Parcourir toutes les locations actives
  FOR location_record IN 
    SELECT id, date_debut, loyer_mensuel 
    FROM public.locations 
    WHERE statut = 'active'
  LOOP
    -- Calculer le nombre d'années complètes écoulées depuis le début
    annees_ecoules = EXTRACT(YEAR FROM AGE(CURRENT_DATE, location_record.date_debut));
    
    -- Calculer le nombre de mois dans l'année courante
    mois_dans_annee_courante = EXTRACT(MONTH FROM AGE(CURRENT_DATE, location_record.date_debut));
    
    -- Calculer le montant total payé pour cette location
    SELECT COALESCE(SUM(montant), 0) INTO total_paye
    FROM public.paiements_locations 
    WHERE location_id = location_record.id;
    
    -- Calculer la dette selon l'année
    IF annees_ecoules = 0 THEN
      -- Première année: dette = loyer × 10 (car 2 mois d'avance déjà payés)
      dette_annuelle = location_record.loyer_mensuel * 10;
    ELSE
      -- Années suivantes: dette = (années complètes × loyer × 12) + (mois année courante × loyer)
      dette_annuelle = (annees_ecoules * location_record.loyer_mensuel * 12) + 
                       (location_record.loyer_mensuel * 10) + -- première année toujours 10 mois
                       (mois_dans_annee_courante * location_record.loyer_mensuel); -- mois de l'année courante
    END IF;
    
    -- Calculer la dette restante
    nouvelle_dette = GREATEST(0, dette_annuelle - total_paye);
    
    -- Mettre à jour la location avec la nouvelle dette
    UPDATE public.locations 
    SET dette_totale = nouvelle_dette,
        updated_at = now()
    WHERE id = location_record.id;
    
  END LOOP;
  
  RAISE NOTICE 'Mise à jour terminée pour toutes les locations actives';
END $$;