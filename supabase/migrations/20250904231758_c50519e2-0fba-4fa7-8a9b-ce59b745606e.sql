
-- 1) Schema adjustments
BEGIN;

-- Allow receipts without a client (for versement_agent, facture)
ALTER TABLE public.recus
  ALTER COLUMN client_id DROP NOT NULL;

-- Add meta JSONB to store autoportant information
ALTER TABLE public.recus
  ADD COLUMN IF NOT EXISTS meta jsonb;

-- Unique key to guarantee one receipt per (type_operation, reference_id)
CREATE UNIQUE INDEX IF NOT EXISTS recus_type_operation_reference_idx
  ON public.recus (type_operation, reference_id);

-- Internal counters to generate dated, sequential receipt numbers per prefix and day
CREATE TABLE IF NOT EXISTS public.receipt_counters (
  date_key date NOT NULL,
  prefix text NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (date_key, prefix)
);

-- 2) Dated sequence generator for receipt numbers
CREATE OR REPLACE FUNCTION public.generate_receipt_number(p_type_operation text)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  v_prefix text;
  v_date text;
  v_next integer;
BEGIN
  v_prefix := CASE p_type_operation
    WHEN 'location' THEN 'REC-LOC'
    WHEN 'apport_souscription' THEN 'REC-SOUS'
    WHEN 'droit_terre' THEN 'REC-DTER'
    WHEN 'paiement_facture' THEN 'REC-FACT'
    WHEN 'caution_location' THEN 'REC-CAUT'
    WHEN 'versement_agent' THEN 'REC-VERS'
    ELSE 'REC-GEN'
  END;

  v_date := to_char(current_date, 'YYMMDD');

  INSERT INTO public.receipt_counters AS rc (date_key, prefix, last_number)
  VALUES (current_date, v_prefix, 1)
  ON CONFLICT (date_key, prefix)
  DO UPDATE SET last_number = rc.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN v_prefix || '-' || v_date || '-' || lpad(v_next::text, 4, '0');
END;
$function$;

-- 3) Trigger: Souscription payments -> receipts
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
    v_numero, v_souscription.client_id, NEW.id, 'apport_souscription', NEW.montant, NEW.date_paiement, NULL, NULL, v_meta
  )
  ON CONFLICT (type_operation, reference_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS after_insert_paiements_souscriptions ON public.paiements_souscriptions;
CREATE TRIGGER after_insert_paiements_souscriptions
AFTER INSERT ON public.paiements_souscriptions
FOR EACH ROW EXECUTE PROCEDURE public.tg_create_receipt_paiement_souscription();

-- 4) Trigger: Location (rent) payments -> receipts
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
    v_numero, v_location.client_id, NEW.id, 'location', NEW.montant, NEW.date_paiement, NULL, NULL, v_meta
  )
  ON CONFLICT (type_operation, reference_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS after_insert_paiements_locations ON public.paiements_locations;
CREATE TRIGGER after_insert_paiements_locations
AFTER INSERT ON public.paiements_locations
FOR EACH ROW EXECUTE PROCEDURE public.tg_create_receipt_paiement_location();

-- 5) Trigger: Droit de terre payments -> receipts
CREATE OR REPLACE FUNCTION public.tg_create_receipt_paiement_droit_terre()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_souscription record;
  v_remaining numeric;
  v_status text;
  v_meta jsonb;
  v_numero text;
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

  -- Remaining for 'droit_terre' based on months elapsed and payments
  SELECT public.calculate_solde_droit_terre(NEW.souscription_id) INTO v_remaining;

  v_status := CASE WHEN v_remaining <= 0 THEN 'solde' ELSE 'partiel' END;

  v_meta := jsonb_build_object(
    'client_name', coalesce(v_souscription.client_prenom, '') || ' ' || v_souscription.client_nom,
    'objet_type', 'droit_terre',
    'objet_id', v_souscription.id,
    'property_name', v_souscription.propriete_nom,
    'reste_a_payer', greatest(0, v_remaining),
    'statut', v_status
  );

  v_numero := public.generate_receipt_number('droit_terre');

  INSERT INTO public.recus (
    numero, client_id, reference_id, type_operation, montant_total, date_generation, periode_debut, periode_fin, meta
  )
  VALUES (
    v_numero, v_souscription.client_id, NEW.id, 'droit_terre', NEW.montant, NEW.date_paiement, NULL, NULL, v_meta
  )
  ON CONFLICT (type_operation, reference_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS after_insert_paiements_droit_terre ON public.paiements_droit_terre;
CREATE TRIGGER after_insert_paiements_droit_terre
AFTER INSERT ON public.paiements_droit_terre
FOR EACH ROW EXECUTE PROCEDURE public.tg_create_receipt_paiement_droit_terre();

-- 6) Trigger: Facture payments -> receipts
CREATE OR REPLACE FUNCTION public.tg_create_receipt_paiement_facture()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_facture record;
  v_total_paye numeric;
  v_remaining numeric;
  v_status text;
  v_meta jsonb;
  v_numero text;
BEGIN
  SELECT f.*, p.nom AS propriete_nom
  INTO v_facture
  FROM public.factures_fournisseurs f
  LEFT JOIN public.proprietes p ON p.id = f.propriete_id
  WHERE f.id = NEW.facture_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(montant), 0) INTO v_total_paye
  FROM public.paiements_factures
  WHERE facture_id = v_facture.id;

  v_remaining := greatest(0, v_facture.montant_total - v_total_paye);
  v_status := CASE WHEN v_remaining = 0 THEN 'solde' ELSE 'partiel' END;

  v_meta := jsonb_build_object(
    'client_name', NULL,
    'objet_type', 'facture',
    'objet_id', v_facture.id,
    'property_name', v_facture.propriete_nom,
    'reste_a_payer', v_remaining,
    'statut', v_status
  );

  v_numero := public.generate_receipt_number('paiement_facture');

  INSERT INTO public.recus (
    numero, client_id, reference_id, type_operation, montant_total, date_generation, periode_debut, periode_fin, meta
  )
  VALUES (
    v_numero, NULL, NEW.id, 'paiement_facture', NEW.montant, NEW.date_paiement, NULL, NULL, v_meta
  )
  ON CONFLICT (type_operation, reference_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS after_insert_paiements_factures ON public.paiements_factures;
CREATE TRIGGER after_insert_paiements_factures
AFTER INSERT ON public.paiements_factures
FOR EACH ROW EXECUTE PROCEDURE public.tg_create_receipt_paiement_facture();

-- 7) Trigger: Cash transactions -> receipts (caution_location, versement_agent)
CREATE OR REPLACE FUNCTION public.tg_create_receipt_cash_transaction()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_location record;
  v_meta jsonb;
  v_numero text;
BEGIN
  IF NEW.type_operation = 'paiement_caution' THEN
    SELECT l.*, c.nom AS client_nom, c.prenom AS client_prenom, p.nom AS propriete_nom
    INTO v_location
    FROM public.locations l
    JOIN public.clients c ON c.id = l.client_id
    JOIN public.proprietes p ON p.id = l.propriete_id
    WHERE l.id = NEW.reference_operation;

    IF FOUND THEN
      v_numero := public.generate_receipt_number('caution_location');

      v_meta := jsonb_build_object(
        'client_name', coalesce(v_location.client_prenom, '') || ' ' || v_location.client_nom,
        'objet_type', 'caution',
        'objet_id', v_location.id,
        'property_name', v_location.propriete_nom,
        'reste_a_payer', 0,
        'statut', 'solde'
      );

      INSERT INTO public.recus (
        numero, client_id, reference_id, type_operation, montant_total, date_generation, periode_debut, periode_fin, meta
      )
      VALUES (
        v_numero, v_location.client_id, NEW.id, 'caution_location', NEW.montant, NEW.date_transaction, NULL, NULL, v_meta
      )
      ON CONFLICT (type_operation, reference_id) DO NOTHING;
    END IF;
  ELSIF NEW.type_operation = 'versement_agent' THEN
    v_numero := public.generate_receipt_number('versement_agent');

    v_meta := jsonb_build_object(
      'client_name', NULL,
      'objet_type', 'versement_agent',
      'objet_id', NEW.agent_id,
      'property_name', NULL,
      'reste_a_payer', 0,
      'statut', 'solde'
    );

    INSERT INTO public.recus (
      numero, client_id, reference_id, type_operation, montant_total, date_generation, periode_debut, periode_fin, meta
    )
    VALUES (
      v_numero, NULL, NEW.id, 'versement_agent', NEW.montant, NEW.date_transaction, NULL, NULL, v_meta
    )
    ON CONFLICT (type_operation, reference_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS after_insert_cash_transactions ON public.cash_transactions;
CREATE TRIGGER after_insert_cash_transactions
AFTER INSERT ON public.cash_transactions
FOR EACH ROW EXECUTE PROCEDURE public.tg_create_receipt_cash_transaction();

-- 8) Backfill in one transaction
-- 8.1 Normalize existing type_operation values
UPDATE public.recus SET type_operation = 'location'
WHERE type_operation IN ('paiement_loyer', 'location');

UPDATE public.recus SET type_operation = 'apport_souscription'
WHERE type_operation IN ('paiement_souscription', 'apport_souscription');

UPDATE public.recus SET type_operation = 'caution_location'
WHERE type_operation IN ('paiement_caution', 'caution_location');

UPDATE public.recus SET type_operation = 'droit_terre'
WHERE type_operation IN ('droit_terre');

UPDATE public.recus SET type_operation = 'paiement_facture'
WHERE type_operation IN ('paiement_facture');

UPDATE public.recus SET type_operation = 'versement_agent'
WHERE type_operation IN ('versement_agent');

-- 8.2 Fix reference_id for existing receipts by matching payment rows
-- Souscriptions: if receipts referenced souscription_id, point them to the exact paiement id
UPDATE public.recus r
SET reference_id = ps.id
FROM public.paiements_souscriptions ps
WHERE r.type_operation = 'apport_souscription'
  AND r.reference_id = ps.souscription_id
  AND abs((r.montant_total - ps.montant)) < 0.01
  AND r.date_generation = ps.date_paiement;

-- Locations: from location_id to paiement id
UPDATE public.recus r
SET reference_id = pl.id
FROM public.paiements_locations pl
WHERE r.type_operation = 'location'
  AND r.reference_id = pl.location_id
  AND abs((r.montant_total - pl.montant)) < 0.01
  AND r.date_generation = pl.date_paiement;

-- Factures: from facture_id to paiement id
UPDATE public.recus r
SET reference_id = pf.id
FROM public.paiements_factures pf
WHERE r.type_operation = 'paiement_facture'
  AND r.reference_id = pf.facture_id
  AND abs((r.montant_total - pf.montant)) < 0.01
  AND r.date_generation = pf.date_paiement;

-- Caution: from location_id to cash_transactions.id (paiement_caution)
UPDATE public.recus r
SET reference_id = ct.id
FROM public.cash_transactions ct
WHERE r.type_operation = 'caution_location'
  AND ct.type_operation = 'paiement_caution'
  AND ct.reference_operation = r.reference_id
  AND abs((ct.montant - r.montant_total)) < 0.01
  AND ct.date_transaction = r.date_generation;

-- 8.3 Insert missing receipts for all payments (idempotent with unique index)
-- Souscriptions
INSERT INTO public.recus (numero, client_id, reference_id, type_operation, montant_total, date_generation, periode_debut, periode_fin, meta)
SELECT
  public.generate_receipt_number('apport_souscription') AS numero,
  s.client_id,
  ps.id,
  'apport_souscription',
  ps.montant,
  ps.date_paiement,
  NULL,
  NULL,
  jsonb_build_object(
    'client_name', coalesce(c.prenom, '') || ' ' || c.nom,
    'objet_type', 'souscription',
    'objet_id', s.id,
    'property_name', p.nom,
    'reste_a_payer', greatest(0, s.prix_total - COALESCE(ps_total.total_paye, 0)),
    'statut', CASE WHEN greatest(0, s.prix_total - COALESCE(ps_total.total_paye, 0)) = 0 THEN 'solde' ELSE 'partiel' END
  ) AS meta
FROM public.paiements_souscriptions ps
JOIN public.souscriptions s ON s.id = ps.souscription_id
JOIN public.clients c ON c.id = s.client_id
JOIN public.proprietes p ON p.id = s.propriete_id
LEFT JOIN (
  SELECT souscription_id, SUM(montant) AS total_paye
  FROM public.paiements_souscriptions
  GROUP BY souscription_id
) ps_total ON ps_total.souscription_id = s.id
LEFT JOIN public.recus r ON r.type_operation = 'apport_souscription' AND r.reference_id = ps.id
WHERE r.id IS NULL
ON CONFLICT (type_operation, reference_id) DO NOTHING;

-- Locations
INSERT INTO public.recus (numero, client_id, reference_id, type_operation, montant_total, date_generation, periode_debut, periode_fin, meta)
SELECT
  public.generate_receipt_number('location') AS numero,
  l.client_id,
  pl.id,
  'location',
  pl.montant,
  pl.date_paiement,
  NULL,
  NULL,
  jsonb_build_object(
    'client_name', coalesce(c.prenom, '') || ' ' || c.nom,
    'objet_type', 'location',
    'objet_id', l.id,
    'property_name', p.nom,
    'reste_a_payer', greatest(
      0,
      ((CASE
        WHEN EXTRACT(YEAR FROM AGE(current_date, l.date_debut)) = 0
        THEN l.loyer_mensuel * 10
        ELSE (l.loyer_mensuel * 10)
             + (EXTRACT(YEAR FROM AGE(current_date, l.date_debut))::int * l.loyer_mensuel * 12)
             + (EXTRACT(MONTH FROM AGE(current_date, l.date_debut))::int * l.loyer_mensuel)
      END)::numeric)
      - COALESCE(pl_total.total_paye, 0)
    ),
    'statut', CASE
      WHEN greatest(
        0,
        ((CASE
          WHEN EXTRACT(YEAR FROM AGE(current_date, l.date_debut)) = 0
          THEN l.loyer_mensuel * 10
          ELSE (l.loyer_mensuel * 10)
               + (EXTRACT(YEAR FROM AGE(current_date, l.date_debut))::int * l.loyer_mensuel * 12)
               + (EXTRACT(MONTH FROM AGE(current_date, l.date_debut))::int * l.loyer_mensuel)
        END)::numeric)
        - COALESCE(pl_total.total_paye, 0)
      ) = 0 THEN 'solde' ELSE 'partiel' END
  ) AS meta
FROM public.paiements_locations pl
JOIN public.locations l ON l.id = pl.location_id
JOIN public.clients c ON c.id = l.client_id
LEFT JOIN public.proprietes p ON p.id = l.propriete_id
LEFT JOIN (
  SELECT location_id, SUM(montant) AS total_paye
  FROM public.paiements_locations
  GROUP BY location_id
) pl_total ON pl_total.location_id = l.id
LEFT JOIN public.recus r ON r.type_operation = 'location' AND r.reference_id = pl.id
WHERE r.id IS NULL
ON CONFLICT (type_operation, reference_id) DO NOTHING;

-- Droit de terre
INSERT INTO public.recus (numero, client_id, reference_id, type_operation, montant_total, date_generation, periode_debut, periode_fin, meta)
SELECT
  public.generate_receipt_number('droit_terre') AS numero,
  s.client_id,
  pd.id,
  'droit_terre',
  pd.montant,
  pd.date_paiement,
  NULL,
  NULL,
  jsonb_build_object(
    'client_name', coalesce(c.prenom, '') || ' ' || c.nom,
    'objet_type', 'droit_terre',
    'objet_id', s.id,
    'property_name', p.nom,
    'reste_a_payer', greatest(0, public.calculate_solde_droit_terre(s.id)),
    'statut', CASE WHEN public.calculate_solde_droit_terre(s.id) <= 0 THEN 'solde' ELSE 'partiel' END
  ) AS meta
FROM public.paiements_droit_terre pd
JOIN public.souscriptions s ON s.id = pd.souscription_id
JOIN public.clients c ON c.id = s.client_id
JOIN public.proprietes p ON p.id = s.propriete_id
LEFT JOIN public.recus r ON r.type_operation = 'droit_terre' AND r.reference_id = pd.id
WHERE r.id IS NULL
ON CONFLICT (type_operation, reference_id) DO NOTHING;

-- Factures
INSERT INTO public.recus (numero, client_id, reference_id, type_operation, montant_total, date_generation, periode_debut, periode_fin, meta)
SELECT
  public.generate_receipt_number('paiement_facture') AS numero,
  NULL::uuid,
  pf.id,
  'paiement_facture',
  pf.montant,
  pf.date_paiement,
  NULL,
  NULL,
  jsonb_build_object(
    'client_name', NULL,
    'objet_type', 'facture',
    'objet_id', f.id,
    'property_name', p.nom,
    'reste_a_payer', greatest(0, f.montant_total - COALESCE(pf_total.total_paye, 0)),
    'statut', CASE WHEN greatest(0, f.montant_total - COALESCE(pf_total.total_paye, 0)) = 0 THEN 'solde' ELSE 'partiel' END
  ) AS meta
FROM public.paiements_factures pf
JOIN public.factures_fournisseurs f ON f.id = pf.facture_id
LEFT JOIN public.proprietes p ON p.id = f.propriete_id
LEFT JOIN (
  SELECT facture_id, SUM(montant) AS total_paye
  FROM public.paiements_factures
  GROUP BY facture_id
) pf_total ON pf_total.facture_id = f.id
LEFT JOIN public.recus r ON r.type_operation = 'paiement_facture' AND r.reference_id = pf.id
WHERE r.id IS NULL
ON CONFLICT (type_operation, reference_id) DO NOTHING;

-- Caution (depuis cash_transactions)
INSERT INTO public.recus (numero, client_id, reference_id, type_operation, montant_total, date_generation, periode_debut, periode_fin, meta)
SELECT
  public.generate_receipt_number('caution_location') AS numero,
  l.client_id,
  ct.id,
  'caution_location',
  ct.montant,
  ct.date_transaction,
  NULL,
  NULL,
  jsonb_build_object(
    'client_name', coalesce(c.prenom, '') || ' ' || c.nom,
    'objet_type', 'caution',
    'objet_id', l.id,
    'property_name', p.nom,
    'reste_a_payer', 0,
    'statut', 'solde'
  ) AS meta
FROM public.cash_transactions ct
JOIN public.locations l ON l.id = ct.reference_operation
JOIN public.clients c ON c.id = l.client_id
LEFT JOIN public.proprietes p ON p.id = l.propriete_id
LEFT JOIN public.recus r ON r.type_operation = 'caution_location' AND r.reference_id = ct.id
WHERE ct.type_operation = 'paiement_caution'
  AND r.id IS NULL
ON CONFLICT (type_operation, reference_id) DO NOTHING;

-- Versement agent (depuis cash_transactions)
INSERT INTO public.recus (numero, client_id, reference_id, type_operation, montant_total, date_generation, periode_debut, periode_fin, meta)
SELECT
  public.generate_receipt_number('versement_agent') AS numero,
  NULL::uuid,
  ct.id,
  'versement_agent',
  ct.montant,
  ct.date_transaction,
  NULL,
  NULL,
  jsonb_build_object(
    'client_name', NULL,
    'objet_type', 'versement_agent',
    'objet_id', ct.agent_id,
    'property_name', NULL,
    'reste_a_payer', 0,
    'statut', 'solde'
  ) AS meta
FROM public.cash_transactions ct
LEFT JOIN public.recus r ON r.type_operation = 'versement_agent' AND r.reference_id = ct.id
WHERE ct.type_operation = 'versement_agent'
  AND r.id IS NULL
ON CONFLICT (type_operation, reference_id) DO NOTHING;

-- 8.4 Recompute or fill meta for existing receipts (idempotent)
-- Souscriptions
UPDATE public.recus r
SET meta = jsonb_build_object(
  'client_name', coalesce(c.prenom, '') || ' ' || c.nom,
  'objet_type', 'souscription',
  'objet_id', s.id,
  'property_name', p.nom,
  'reste_a_payer', greatest(0, s.prix_total - COALESCE(ps_total.total_paye, 0)),
  'statut', CASE WHEN greatest(0, s.prix_total - COALESCE(ps_total.total_paye, 0)) = 0 THEN 'solde' ELSE 'partiel' END
)
FROM public.paiements_souscriptions ps
JOIN public.souscriptions s ON s.id = ps.souscription_id
JOIN public.clients c ON c.id = s.client_id
JOIN public.proprietes p ON p.id = s.propriete_id
LEFT JOIN (
  SELECT souscription_id, SUM(montant) AS total_paye FROM public.paiements_souscriptions GROUP BY souscription_id
) ps_total ON ps_total.souscription_id = s.id
WHERE r.type_operation = 'apport_souscription' AND r.reference_id = ps.id;

-- Locations
UPDATE public.recus r
SET meta = jsonb_build_object(
  'client_name', coalesce(c.prenom, '') || ' ' || c.nom,
  'objet_type', 'location',
  'objet_id', l.id,
  'property_name', p.nom,
  'reste_a_payer', greatest(
    0,
    ((CASE
      WHEN EXTRACT(YEAR FROM AGE(current_date, l.date_debut)) = 0
      THEN l.loyer_mensuel * 10
      ELSE (l.loyer_mensuel * 10)
           + (EXTRACT(YEAR FROM AGE(current_date, l.date_debut))::int * l.loyer_mensuel * 12)
           + (EXTRACT(MONTH FROM AGE(current_date, l.date_debut))::int * l.loyer_mensuel)
    END)::numeric)
    - COALESCE(pl_total.total_paye, 0)
  ),
  'statut', CASE
    WHEN greatest(
      0,
      ((CASE
        WHEN EXTRACT(YEAR FROM AGE(current_date, l.date_debut)) = 0
        THEN l.loyer_mensuel * 10
        ELSE (l.loyer_mensuel * 10)
             + (EXTRACT(YEAR FROM AGE(current_date, l.date_debut))::int * l.loyer_mensuel * 12)
             + (EXTRACT(MONTH FROM AGE(current_date, l.date_debut))::int * l.loyer_mensuel)
      END)::numeric)
      - COALESCE(pl_total.total_paye, 0)
    ) = 0 THEN 'solde' ELSE 'partiel' END
)
FROM public.paiements_locations pl
JOIN public.locations l ON l.id = pl.location_id
JOIN public.clients c ON c.id = l.client_id
LEFT JOIN public.proprietes p ON p.id = l.propriete_id
LEFT JOIN (
  SELECT location_id, SUM(montant) AS total_paye FROM public.paiements_locations GROUP BY location_id
) pl_total ON pl_total.location_id = l.id
WHERE r.type_operation = 'location' AND r.reference_id = pl.id;

-- Droit de terre
UPDATE public.recus r
SET meta = jsonb_build_object(
  'client_name', coalesce(c.prenom, '') || ' ' || c.nom,
  'objet_type', 'droit_terre',
  'objet_id', s.id,
  'property_name', p.nom,
  'reste_a_payer', greatest(0, public.calculate_solde_droit_terre(s.id)),
  'statut', CASE WHEN public.calculate_solde_droit_terre(s.id) <= 0 THEN 'solde' ELSE 'partiel' END
)
FROM public.paiements_droit_terre pd
JOIN public.souscriptions s ON s.id = pd.souscription_id
JOIN public.clients c ON c.id = s.client_id
JOIN public.proprietes p ON p.id = s.propriete_id
WHERE r.type_operation = 'droit_terre' AND r.reference_id = pd.id;

-- Factures
UPDATE public.recus r
SET meta = jsonb_build_object(
  'client_name', NULL,
  'objet_type', 'facture',
  'objet_id', f.id,
  'property_name', p.nom,
  'reste_a_payer', greatest(0, f.montant_total - COALESCE(pf_total.total_paye, 0)),
  'statut', CASE WHEN greatest(0, f.montant_total - COALESCE(pf_total.total_paye, 0)) = 0 THEN 'solde' ELSE 'partiel' END
)
FROM public.paiements_factures pf
JOIN public.factures_fournisseurs f ON f.id = pf.facture_id
LEFT JOIN public.proprietes p ON p.id = f.propriete_id
LEFT JOIN (
  SELECT facture_id, SUM(montant) AS total_paye FROM public.paiements_factures GROUP BY facture_id
) pf_total ON pf_total.facture_id = f.id
WHERE r.type_operation = 'paiement_facture' AND r.reference_id = pf.id;

-- Caution
UPDATE public.recus r
SET meta = jsonb_build_object(
  'client_name', coalesce(c.prenom, '') || ' ' || c.nom,
  'objet_type', 'caution',
  'objet_id', l.id,
  'property_name', p.nom,
  'reste_a_payer', 0,
  'statut', 'solde'
)
FROM public.cash_transactions ct
JOIN public.locations l ON l.id = ct.reference_operation
JOIN public.clients c ON c.id = l.client_id
LEFT JOIN public.proprietes p ON p.id = l.propriete_id
WHERE r.type_operation = 'caution_location' AND r.reference_id = ct.id;

-- Versement agent
UPDATE public.recus r
SET meta = jsonb_build_object(
  'client_name', NULL,
  'objet_type', 'versement_agent',
  'objet_id', ct.agent_id,
  'property_name', NULL,
  'reste_a_payer', 0,
  'statut', 'solde'
)
FROM public.cash_transactions ct
WHERE r.type_operation = 'versement_agent' AND r.reference_id = ct.id;

COMMIT;
