-- Corriger la fonction pour générer les paiements manquants des souscriptions historiques
CREATE OR REPLACE FUNCTION public.generate_missing_historical_payments()
 RETURNS TABLE(souscription_id uuid, montant_genere numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  sub_record RECORD;
  total_paye DECIMAL;
  montant_a_generer DECIMAL;
BEGIN
  -- Parcourir toutes les souscriptions historiques
  FOR sub_record IN 
    SELECT s.id, s.prix_total, s.created_at, s.date_debut, s.type_souscription,
           c.nom, c.prenom
    FROM public.souscriptions s
    JOIN public.clients c ON s.client_id = c.id
    WHERE s.type_souscription IN ('mise_en_garde', 'historique')
  LOOP
    -- Vérifier s'il y a déjà des paiements pour cette souscription
    SELECT COALESCE(SUM(montant), 0) INTO total_paye
    FROM public.paiements_souscriptions 
    WHERE paiements_souscriptions.souscription_id = sub_record.id;
    
    -- Si aucun paiement existant, générer un paiement fictif
    IF total_paye = 0 THEN
      montant_a_generer := sub_record.prix_total;
      
      -- Créer un paiement fictif avec la date de début ou de création
      INSERT INTO public.paiements_souscriptions (
        souscription_id,
        montant,
        date_paiement,
        mode_paiement,
        reference
      ) VALUES (
        sub_record.id,
        montant_a_generer,
        COALESCE(sub_record.date_debut, sub_record.created_at::date),
        'especes',
        'Import historique - Paiement complet'
      );
      
      -- Retourner les détails
      souscription_id := sub_record.id;
      montant_genere := montant_a_generer;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;