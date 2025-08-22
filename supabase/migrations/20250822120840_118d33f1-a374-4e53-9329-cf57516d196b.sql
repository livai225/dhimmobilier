
-- 1) Seed initial si nécessaire
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.caisse_balance) THEN
    INSERT INTO public.caisse_balance (solde_courant) VALUES (0);
  END IF;
END$$;

-- 2) RPC: Paiement de loyer avec écriture caisse
CREATE OR REPLACE FUNCTION public.pay_location_with_cash(
  p_location_id uuid,
  p_montant numeric,
  p_date_paiement date,
  p_mode_paiement text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_id uuid;
  v_client_name text;
  v_property_name text;
BEGIN
  IF NOT public.can_make_payment(p_montant) THEN
    RAISE EXCEPTION 'Solde insuffisant dans la caisse (%%). Montant requis: %%', public.get_current_cash_balance(), p_montant;
  END IF;

  INSERT INTO public.paiements_locations (location_id, montant, date_paiement, mode_paiement, reference)
  VALUES (p_location_id, p_montant, p_date_paiement, p_mode_paiement, p_reference)
  RETURNING id INTO v_payment_id;

  SELECT CONCAT(COALESCE(c.prenom,''),' ',COALESCE(c.nom,'')) AS client_name,
         pr.nom AS property_name
    INTO v_client_name, v_property_name
  FROM public.locations l
  LEFT JOIN public.clients c ON c.id = l.client_id
  LEFT JOIN public.proprietes pr ON pr.id = l.propriete_id
  WHERE l.id = p_location_id;

  PERFORM public.record_cash_transaction(
    'sortie',
    p_montant,
    'paiement_loyer',
    NULL,
    COALESCE(v_property_name, v_client_name),
    p_location_id,
    COALESCE(p_description, 'Paiement loyer'),
    NULL
  );

  RETURN v_payment_id;
END;
$$;

-- 3) RPC: Paiement de souscription avec écriture caisse
CREATE OR REPLACE FUNCTION public.pay_souscription_with_cash(
  p_souscription_id uuid,
  p_montant numeric,
  p_date_paiement date,
  p_mode_paiement text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_id uuid;
  v_client_name text;
  v_prix_total numeric;
  v_total_paye numeric;
BEGIN
  IF NOT public.can_make_payment(p_montant) THEN
    RAISE EXCEPTION 'Solde insuffisant dans la caisse (%%). Montant requis: %%', public.get_current_cash_balance(), p_montant;
  END IF;

  INSERT INTO public.paiements_souscriptions (souscription_id, montant, date_paiement, mode_paiement, reference)
  VALUES (p_souscription_id, p_montant, p_date_paiement, p_mode_paiement, p_reference)
  RETURNING id INTO v_payment_id;

  -- Recalcule le solde de la souscription après paiement
  SELECT s.prix_total INTO v_prix_total FROM public.souscriptions s WHERE s.id = p_souscription_id;
  SELECT COALESCE(SUM(ps.montant), 0) INTO v_total_paye FROM public.paiements_souscriptions ps WHERE ps.souscription_id = p_souscription_id;
  UPDATE public.souscriptions
     SET solde_restant = GREATEST(0, v_prix_total - v_total_paye),
         updated_at = now()
   WHERE id = p_souscription_id;

  -- Beneficiaire = nom du client
  SELECT CONCAT(COALESCE(c.prenom,''),' ',COALESCE(c.nom,''))
    INTO v_client_name
  FROM public.souscriptions s
  LEFT JOIN public.clients c ON c.id = s.client_id
  WHERE s.id = p_souscription_id;

  PERFORM public.record_cash_transaction(
    'sortie',
    p_montant,
    'paiement_souscription',
    NULL,
    v_client_name,
    p_souscription_id,
    COALESCE(p_description, 'Paiement souscription'),
    NULL
  );

  RETURN v_payment_id;
END;
$$;

-- 4) RPC: Paiement de droit de terre avec écriture caisse
CREATE OR REPLACE FUNCTION public.pay_droit_terre_with_cash(
  p_souscription_id uuid,
  p_montant numeric,
  p_date_paiement date,
  p_mode_paiement text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_id uuid;
  v_client_name text;
BEGIN
  IF NOT public.can_make_payment(p_montant) THEN
    RAISE EXCEPTION 'Solde insuffisant dans la caisse (%%). Montant requis: %%', public.get_current_cash_balance(), p_montant;
  END IF;

  INSERT INTO public.paiements_droit_terre (souscription_id, montant, date_paiement, mode_paiement, reference)
  VALUES (p_souscription_id, p_montant, p_date_paiement, p_mode_paiement, p_reference)
  RETURNING id INTO v_payment_id;

  SELECT CONCAT(COALESCE(c.prenom,''),' ',COALESCE(c.nom,''))
    INTO v_client_name
  FROM public.souscriptions s
  LEFT JOIN public.clients c ON c.id = s.client_id
  WHERE s.id = p_souscription_id;

  PERFORM public.record_cash_transaction(
    'sortie',
    p_montant,
    'paiement_droit_terre',
    NULL,
    v_client_name,
    p_souscription_id,
    COALESCE(p_description, 'Paiement droit de terre'),
    NULL
  );

  RETURN v_payment_id;
END;
$$;

-- 5) RPC: Paiement facture fournisseur (dépense) avec écriture caisse
CREATE OR REPLACE FUNCTION public.pay_facture_with_cash(
  p_facture_id uuid,
  p_montant numeric,
  p_date_paiement date,
  p_mode_paiement text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_id uuid;
  v_fournisseur_nom text;
BEGIN
  IF NOT public.can_make_payment(p_montant) THEN
    RAISE EXCEPTION 'Solde insuffisant dans la caisse (%%). Montant requis: %%', public.get_current_cash_balance(), p_montant;
  END IF;

  -- Insère le paiement (les triggers de validation/MAJ totals s'appliqueront)
  INSERT INTO public.paiements_factures (facture_id, montant, date_paiement, mode_paiement, reference)
  VALUES (p_facture_id, p_montant, p_date_paiement, p_mode_paiement, p_reference)
  RETURNING id INTO v_payment_id;

  SELECT f.nom INTO v_fournisseur_nom
  FROM public.factures_fournisseurs ff
  LEFT JOIN public.fournisseurs f ON f.id = ff.fournisseur_id
  WHERE ff.id = p_facture_id;

  PERFORM public.record_cash_transaction(
    'sortie',
    p_montant,
    'depense_entreprise',
    NULL,
    v_fournisseur_nom,
    p_facture_id,
    COALESCE(p_description, 'Paiement facture fournisseur'),
    NULL
  );

  RETURN v_payment_id;
END;
$$;

-- 6) Triggers manquants (cohérence métier)

-- Factures: interdiction de surpaiement + mise à jour des totaux
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validate_payment_amount'
  ) THEN
    CREATE TRIGGER trg_validate_payment_amount
    BEFORE INSERT ON public.paiements_factures
    FOR EACH ROW EXECUTE FUNCTION public.validate_payment_amount();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_facture_totals'
  ) THEN
    CREATE TRIGGER trg_update_facture_totals
    AFTER INSERT ON public.paiements_factures
    FOR EACH ROW EXECUTE FUNCTION public.update_facture_totals();
  END IF;
END$$;

-- Locations: recalcul dette après paiement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_location_on_payment'
  ) THEN
    CREATE TRIGGER trg_update_location_on_payment
    AFTER INSERT ON public.paiements_locations
    FOR EACH ROW EXECUTE FUNCTION public.update_location_on_payment();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_calculate_location_dette_ins'
  ) THEN
    CREATE TRIGGER trg_calculate_location_dette_ins
    BEFORE INSERT ON public.locations
    FOR EACH ROW EXECUTE FUNCTION public.calculate_location_dette();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_calculate_location_dette_upd'
  ) THEN
    CREATE TRIGGER trg_calculate_location_dette_upd
    BEFORE UPDATE ON public.locations
    FOR EACH ROW EXECUTE FUNCTION public.calculate_location_dette();
  END IF;
END$$;

-- Souscriptions: dates et phases calculées
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_calculate_souscription_dates_ins'
  ) THEN
    CREATE TRIGGER trg_calculate_souscription_dates_ins
    BEFORE INSERT ON public.souscriptions
    FOR EACH ROW EXECUTE FUNCTION public.calculate_souscription_dates();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_calculate_souscription_dates_upd'
  ) THEN
    CREATE TRIGGER trg_calculate_souscription_dates_upd
    BEFORE UPDATE ON public.souscriptions
    FOR EACH ROW EXECUTE FUNCTION public.calculate_souscription_dates();
  END IF;
END$$;

-- 7) Realtime sur la caisse
ALTER TABLE public.cash_transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_transactions;
