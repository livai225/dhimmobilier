-- Phase 2: Update RPCs and triggers to handle periode_paiement

-- Update pay_location_with_cash function to accept periode_paiement
CREATE OR REPLACE FUNCTION public.pay_location_with_cash(
  p_location_id uuid, 
  p_montant numeric, 
  p_date_paiement date, 
  p_mode_paiement text DEFAULT NULL::text, 
  p_reference text DEFAULT NULL::text, 
  p_description text DEFAULT 'Paiement loyer'::text,
  p_periode_paiement date DEFAULT NULL::date
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction_id UUID;
  v_location_record RECORD;
BEGIN
  -- Get location details
  SELECT l.*, c.nom, c.prenom, p.nom as propriete_nom
  INTO v_location_record
  FROM public.locations l
  JOIN public.clients c ON l.client_id = c.id
  JOIN public.proprietes p ON l.propriete_id = p.id
  WHERE l.id = p_location_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Location introuvable'; 
  END IF;

  -- Record cash transaction as SORTIE (cash taken from physical box for company)
  v_transaction_id := public.record_cash_transaction(
    p_type_transaction := 'sortie',
    p_montant := p_montant,
    p_type_operation := 'paiement_loyer',
    p_agent_id := NULL,
    p_beneficiaire := v_location_record.prenom || ' ' || v_location_record.nom,
    p_reference_operation := p_location_id,
    p_description := p_description || ' - ' || v_location_record.propriete_nom,
    p_piece_justificative := p_reference
  );

  -- Record location payment with periode_paiement
  INSERT INTO public.paiements_locations (location_id, montant, date_paiement, mode_paiement, reference, periode_paiement)
  VALUES (p_location_id, p_montant, p_date_paiement, p_mode_paiement, p_reference, p_periode_paiement);

  RETURN v_transaction_id;
END;
$function$;

-- Update pay_souscription_with_cash function to accept periode_paiement
CREATE OR REPLACE FUNCTION public.pay_souscription_with_cash(
  p_souscription_id uuid, 
  p_montant numeric, 
  p_date_paiement date, 
  p_mode_paiement text DEFAULT NULL::text, 
  p_reference text DEFAULT NULL::text, 
  p_description text DEFAULT 'Paiement souscription'::text,
  p_periode_paiement date DEFAULT NULL::date
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction_id UUID;
  v_souscription_record RECORD;
BEGIN
  -- Get subscription details
  SELECT s.*, c.nom, c.prenom, p.nom as propriete_nom
  INTO v_souscription_record
  FROM public.souscriptions s
  JOIN public.clients c ON s.client_id = c.id
  JOIN public.proprietes p ON s.propriete_id = p.id
  WHERE s.id = p_souscription_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Souscription introuvable'; 
  END IF;

  -- Record cash transaction as SORTIE (cash taken from physical box for company)
  v_transaction_id := public.record_cash_transaction(
    p_type_transaction := 'sortie',
    p_montant := p_montant,
    p_type_operation := 'paiement_souscription',
    p_agent_id := NULL,
    p_beneficiaire := v_souscription_record.prenom || ' ' || v_souscription_record.nom,
    p_reference_operation := p_souscription_id,
    p_description := p_description || ' - ' || v_souscription_record.propriete_nom,
    p_piece_justificative := p_reference
  );

  -- Record subscription payment with periode_paiement
  INSERT INTO public.paiements_souscriptions (souscription_id, montant, date_paiement, mode_paiement, reference, periode_paiement)
  VALUES (p_souscription_id, p_montant, p_date_paiement, p_mode_paiement, p_reference, p_periode_paiement);

  RETURN v_transaction_id;
END;
$function$;

-- Update receipt triggers to use periode_paiement for periods
CREATE OR REPLACE FUNCTION public.tg_create_receipt_paiement_location()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_location record;
  v_total_paye numeric;
  v_annees integer;
  v_mois integer;
  v_du numeric;
  v_remaining numeric;
  v_status text;
  v_meta jsonb;
  v_numero text;
  v_periode_debut date;
  v_periode_fin date;
BEGIN
  SELECT l.*, c.nom AS client_nom, c.prenom AS client_prenom, p.nom AS propriete_nom
  INTO v_location
  FROM public.locations l
  JOIN public.clients c ON c.id = l.client_id
  JOIN public.proprietes p ON p.id = l.propriete_id
  WHERE l.id = NEW.location_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(montant), 0) INTO v_total_paye
  FROM public.paiements_locations
  WHERE location_id = v_location.id;

  SELECT EXTRACT(YEAR FROM AGE(current_date, v_location.date_debut))::int INTO v_annees;
  SELECT EXTRACT(MONTH FROM AGE(current_date, v_location.date_debut))::int INTO v_mois;

  IF v_annees = 0 THEN
    v_du := v_location.loyer_mensuel * 10;
  ELSE
    v_du := (v_location.loyer_mensuel * 10)
          + (v_annees * v_location.loyer_mensuel * 12)
          + (v_mois * v_location.loyer_mensuel);
  END IF;

  v_remaining := greatest(0, v_du - v_total_paye);
  v_status := CASE WHEN v_remaining = 0 THEN 'solde' ELSE 'partiel' END;

  -- Use periode_paiement if available, otherwise use date_paiement
  IF NEW.periode_paiement IS NOT NULL THEN
    v_periode_debut := NEW.periode_paiement;
    v_periode_fin := NEW.periode_paiement + INTERVAL '1 month' - INTERVAL '1 day';
  ELSE
    v_periode_debut := NEW.date_paiement;
    v_periode_fin := NEW.date_paiement;
  END IF;

  v_meta := jsonb_build_object(
    'client_name', coalesce(v_location.client_prenom, '') || ' ' || v_location.client_nom,
    'objet_type', 'location',
    'objet_id', v_location.id,
    'property_name', v_location.propriete_nom,
    'reste_a_payer', v_remaining,
    'statut', v_status
  );

  v_numero := public.generate_receipt_number('location');

  INSERT INTO public.recus (
    numero, client_id, reference_id, type_operation, montant_total, date_generation, periode_debut, periode_fin, meta
  )
  VALUES (
    v_numero, v_location.client_id, NEW.id, 'location', NEW.montant, NEW.date_paiement, v_periode_debut, v_periode_fin, v_meta
  )
  ON CONFLICT (type_operation, reference_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_create_receipt_paiement_souscription()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_souscription record;
  v_remaining numeric;
  v_status text;
  v_meta jsonb;
  v_numero text;
  v_periode_debut date;
  v_periode_fin date;
BEGIN
  SELECT s.*, c.nom AS client_nom, c.prenom AS client_prenom, p.nom AS propriete_nom
  INTO v_souscription
  FROM public.souscriptions s
  JOIN public.clients c ON c.id = s.client_id
  JOIN public.proprietes p ON p.id = s.propriete_id
  WHERE s.id = NEW.souscription_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT greatest(0, v_souscription.prix_total - COALESCE((
    SELECT SUM(montant) FROM public.paiements_souscriptions WHERE souscription_id = NEW.souscription_id
  ), 0)) INTO v_remaining;

  v_status := CASE WHEN v_remaining = 0 THEN 'solde' ELSE 'partiel' END;

  -- Use periode_paiement if available, otherwise use date_paiement
  IF NEW.periode_paiement IS NOT NULL THEN
    v_periode_debut := NEW.periode_paiement;
    v_periode_fin := NEW.periode_paiement + INTERVAL '1 month' - INTERVAL '1 day';
  ELSE
    v_periode_debut := NEW.date_paiement;
    v_periode_fin := NEW.date_paiement;
  END IF;

  v_meta := jsonb_build_object(
    'client_name', coalesce(v_souscription.client_prenom, '') || ' ' || v_souscription.client_nom,
    'objet_type', 'souscription',
    'objet_id', v_souscription.id,
    'property_name', v_souscription.propriete_nom,
    'reste_a_payer', v_remaining,
    'statut', v_status
  );

  v_numero := public.generate_receipt_number('apport_souscription');

  INSERT INTO public.recus (
    numero, client_id, reference_id, type_operation, montant_total, date_generation, periode_debut, periode_fin, meta
  )
  VALUES (
    v_numero, v_souscription.client_id, NEW.id, 'apport_souscription', NEW.montant, NEW.date_paiement, v_periode_debut, v_periode_fin, v_meta
  )
  ON CONFLICT (type_operation, reference_id) DO NOTHING;

  RETURN NEW;
END;
$function$;