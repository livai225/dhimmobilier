-- Comprehensive migration to fix periode_paiement columns and payment functions

-- Step 1: Add missing periode_paiement columns
ALTER TABLE public.paiements_locations ADD COLUMN IF NOT EXISTS periode_paiement DATE;
ALTER TABLE public.paiements_souscriptions ADD COLUMN IF NOT EXISTS periode_paiement DATE;
ALTER TABLE public.paiements_droit_terre ADD COLUMN IF NOT EXISTS periode_paiement DATE;

-- Step 2: Migrate existing data (copy date_paiement to periode_paiement)
UPDATE public.paiements_locations SET periode_paiement = date_paiement WHERE periode_paiement IS NULL;
UPDATE public.paiements_souscriptions SET periode_paiement = date_paiement WHERE periode_paiement IS NULL;
UPDATE public.paiements_droit_terre SET periode_paiement = date_paiement WHERE periode_paiement IS NULL;

-- Step 3: Drop existing duplicate functions if they exist
DROP FUNCTION IF EXISTS public.pay_location_with_cash(uuid, numeric, date, text, text, text);
DROP FUNCTION IF EXISTS public.pay_souscription_with_cash(uuid, numeric, date, text, text, text);

-- Step 4: Recreate pay_location_with_cash with periode_paiement support
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

-- Step 5: Recreate pay_souscription_with_cash with periode_paiement support
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

-- Step 6: Recreate pay_droit_terre_with_cash with periode_paiement support
CREATE OR REPLACE FUNCTION public.pay_droit_terre_with_cash(
  p_souscription_id uuid, 
  p_montant numeric, 
  p_date_paiement date, 
  p_mode_paiement text DEFAULT NULL::text, 
  p_reference text DEFAULT NULL::text, 
  p_description text DEFAULT 'Paiement droit de terre'::text, 
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
    p_type_operation := 'paiement_droit_terre',
    p_agent_id := NULL,
    p_beneficiaire := v_souscription_record.prenom || ' ' || v_souscription_record.nom,
    p_reference_operation := p_souscription_id,
    p_description := p_description || ' - ' || v_souscription_record.propriete_nom,
    p_piece_justificative := p_reference
  );

  -- Record land rights payment with periode_paiement
  INSERT INTO public.paiements_droit_terre (souscription_id, montant, date_paiement, mode_paiement, reference, periode_paiement)
  VALUES (p_souscription_id, p_montant, p_date_paiement, p_mode_paiement, p_reference, p_periode_paiement);

  RETURN v_transaction_id;
END;
$function$;

-- Step 7: Recreate receipt generation trigger for locations
DROP TRIGGER IF EXISTS tg_create_receipt_paiement_location ON public.paiements_locations;

CREATE OR REPLACE FUNCTION public.tg_create_receipt_paiement_location()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_location record;
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
    'reste_a_payer', greatest(0, v_location.dette_totale - NEW.montant),
    'statut', CASE WHEN v_location.dette_totale <= NEW.montant THEN 'solde' ELSE 'partiel' END
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

CREATE TRIGGER tg_create_receipt_paiement_location
AFTER INSERT ON public.paiements_locations
FOR EACH ROW
EXECUTE FUNCTION public.tg_create_receipt_paiement_location();