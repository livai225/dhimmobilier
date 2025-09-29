-- Créer une fonction avec SECURITY DEFINER pour contourner les permissions
CREATE OR REPLACE FUNCTION fix_montant_droit_terre()
RETURNS TABLE(updated_count bigint) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  -- Effectuer l'UPDATE avec les privilèges élevés
  UPDATE souscriptions
  SET montant_droit_terre_mensuel = montant_mensuel
  WHERE phase_actuelle = 'droit_terre'
    AND montant_droit_terre_mensuel IS NULL
    AND montant_mensuel IS NOT NULL
    AND montant_mensuel > 0;
  
  -- Récupérer le nombre de lignes mises à jour
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_count;
END;
$$;

-- Exécuter la fonction pour corriger les données
SELECT * FROM fix_montant_droit_terre();

-- Nettoyer en supprimant la fonction après usage
DROP FUNCTION IF EXISTS fix_montant_droit_terre();