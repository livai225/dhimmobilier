-- Fonction de suppression sécurisée d'une location
CREATE OR REPLACE FUNCTION public.delete_location_safely(p_location_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location RECORD;
  v_paiements_count INTEGER;
  v_total_paiements NUMERIC;
  v_recus_count INTEGER;
  v_cash_transactions_count INTEGER;
  v_report JSONB;
BEGIN
  -- Récupérer les informations de la location
  SELECT l.*, c.nom as client_nom, c.prenom as client_prenom, p.nom as propriete_nom
  INTO v_location
  FROM locations l
  JOIN clients c ON l.client_id = c.id
  JOIN proprietes p ON l.propriete_id = p.id
  WHERE l.id = p_location_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Location introuvable';
  END IF;
  
  -- Compter et calculer les montants
  SELECT COUNT(*), COALESCE(SUM(montant), 0)
  INTO v_paiements_count, v_total_paiements
  FROM paiements_locations
  WHERE location_id = p_location_id;
  
  SELECT COUNT(*)
  INTO v_recus_count
  FROM recus
  WHERE type_operation = 'location' 
    AND reference_id IN (
      SELECT id FROM paiements_locations WHERE location_id = p_location_id
    );
  
  SELECT COUNT(*)
  INTO v_cash_transactions_count
  FROM cash_transactions
  WHERE type_operation = 'paiement_loyer'
    AND reference_operation = p_location_id;
  
  -- Créer le rapport avant suppression
  v_report := jsonb_build_object(
    'location_id', p_location_id,
    'client', v_location.client_prenom || ' ' || v_location.client_nom,
    'propriete', v_location.propriete_nom,
    'paiements_supprimes', v_paiements_count,
    'montant_total_paiements', v_total_paiements,
    'recus_supprimes', v_recus_count,
    'transactions_caisse_supprimees', v_cash_transactions_count
  );
  
  -- Supprimer les reçus liés aux paiements de cette location
  DELETE FROM recus
  WHERE type_operation = 'location' 
    AND reference_id IN (
      SELECT id FROM paiements_locations WHERE location_id = p_location_id
    );
  
  -- Supprimer les paiements caution cash_transactions liés
  DELETE FROM recus
  WHERE type_operation = 'caution_location'
    AND reference_id IN (
      SELECT id FROM cash_transactions 
      WHERE type_operation = 'paiement_caution'
        AND reference_operation = p_location_id
    );
  
  -- Supprimer les transactions caisse liées
  DELETE FROM cash_transactions
  WHERE type_operation IN ('paiement_loyer', 'paiement_caution')
    AND reference_operation = p_location_id;
  
  -- Supprimer les paiements de location
  DELETE FROM paiements_locations
  WHERE location_id = p_location_id;
  
  -- Mettre à jour le statut de la propriété à 'Libre'
  UPDATE proprietes
  SET statut = 'Libre'
  WHERE id = v_location.propriete_id;
  
  -- Supprimer la location
  DELETE FROM locations
  WHERE id = p_location_id;
  
  -- Recalculer les soldes de caisse
  PERFORM recalculate_cash_balances();
  
  -- Logger l'action d'audit
  INSERT INTO audit_logs (
    user_id,
    action_type,
    table_name,
    record_id,
    old_values,
    description
  ) VALUES (
    auth.uid(),
    'DELETE',
    'locations',
    p_location_id,
    jsonb_build_object(
      'client_id', v_location.client_id,
      'propriete_id', v_location.propriete_id,
      'loyer_mensuel', v_location.loyer_mensuel,
      'caution_totale', v_location.caution_totale
    ),
    'Suppression sécurisée de location avec ' || v_paiements_count || ' paiement(s) pour un total de ' || v_total_paiements || ' FCFA'
  );
  
  RETURN v_report;
END;
$$;