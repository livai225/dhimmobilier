-- Fonction pour corriger les soldes des souscriptions historiques
CREATE OR REPLACE FUNCTION public.fix_historical_subscription_balances()
RETURNS TABLE(souscription_id uuid, ancien_solde numeric, nouveau_solde numeric)
LANGUAGE plpgsql
AS $function$
DECLARE
  sub_record RECORD;
  total_paye DECIMAL;
  nouveau_solde DECIMAL;
BEGIN
  -- Parcourir toutes les souscriptions de type 'mise_en_garde' (importées)
  FOR sub_record IN 
    SELECT id, prix_total, solde_restant, type_souscription
    FROM public.souscriptions
    WHERE type_souscription IN ('mise_en_garde', 'historique')
  LOOP
    -- Calculer le total payé pour cette souscription
    SELECT COALESCE(SUM(montant), 0) INTO total_paye
    FROM public.paiements_souscriptions 
    WHERE paiements_souscriptions.souscription_id = sub_record.id;
    
    -- Si le total payé est égal ou supérieur au prix total, marquer comme payé
    IF total_paye >= sub_record.prix_total THEN
      nouveau_solde := 0;
    ELSE
      nouveau_solde := GREATEST(0, sub_record.prix_total - total_paye);
    END IF;
    
    -- Mettre à jour si différent
    IF nouveau_solde != sub_record.solde_restant THEN
      UPDATE public.souscriptions 
      SET solde_restant = nouveau_solde, updated_at = now()
      WHERE id = sub_record.id;
      
      -- Retourner les détails de la correction
      souscription_id := sub_record.id;
      ancien_solde := sub_record.solde_restant;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;

-- Exécuter la correction des soldes
SELECT * FROM public.fix_historical_subscription_balances();