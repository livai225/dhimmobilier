-- Create articles table for inventory items
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  prix_reference NUMERIC DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on articles
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Create policy for articles
CREATE POLICY "Allow all access to articles" 
ON public.articles 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create ventes table for sales tracking
CREATE TABLE public.ventes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID REFERENCES public.articles(id) NOT NULL,
  montant NUMERIC NOT NULL,
  quantite NUMERIC DEFAULT 1,
  date_vente DATE NOT NULL DEFAULT CURRENT_DATE,
  agent_id UUID REFERENCES public.agents_recouvrement(id),
  cash_transaction_id UUID REFERENCES public.cash_transactions(id),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on ventes
ALTER TABLE public.ventes ENABLE ROW LEVEL SECURITY;

-- Create policy for ventes
CREATE POLICY "Allow all access to ventes" 
ON public.ventes 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Update generate_receipt_number function to support 'vente'
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
    WHEN 'vente' THEN 'REC-VENT'
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

-- Update get_solde_caisse_entreprise to include sales
CREATE OR REPLACE FUNCTION public.get_solde_caisse_entreprise()
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  total_revenus NUMERIC := 0;
  total_depenses NUMERIC := 0;
  solde_entreprise NUMERIC := 0;
BEGIN
  -- Calculate total revenues from CLIENT PAYMENTS AND CAUTION ADVANCES
  -- Locations
  SELECT COALESCE(SUM(montant), 0) INTO total_revenus
  FROM public.paiements_locations;
  
  -- Souscriptions
  total_revenus := total_revenus + COALESCE((
    SELECT SUM(montant) FROM public.paiements_souscriptions
  ), 0);
  
  -- Droit de terre
  total_revenus := total_revenus + COALESCE((
    SELECT SUM(montant) FROM public.paiements_droit_terre
  ), 0);
  
  -- Caution payments recorded in cash transactions
  total_revenus := total_revenus + COALESCE((
    SELECT SUM(montant)
    FROM public.cash_transactions
    WHERE type_operation = 'paiement_caution'
  ), 0);

  -- Sales revenue (NEW)
  total_revenus := total_revenus + COALESCE((
    SELECT SUM(montant) FROM public.ventes
  ), 0);

  -- Company expenses
  -- Supplier invoices (amounts paid)
  SELECT COALESCE(SUM(montant_paye), 0) INTO total_depenses
  FROM public.factures_fournisseurs;
  
  -- Include ALL company expenses recorded in cash_transactions as 'depense_entreprise' and 'autre'
  total_depenses := total_depenses + COALESCE((
    SELECT SUM(montant) 
    FROM public.cash_transactions 
    WHERE type_operation IN ('depense_entreprise', 'autre')
  ), 0);
  
  -- Calculate company net balance (revenue - expenses)
  solde_entreprise := total_revenus - total_depenses;
  
  RETURN solde_entreprise;
END;
$function$;

-- Create RPC function to record sales with cash tracking and receipt generation
CREATE OR REPLACE FUNCTION public.record_sale_with_cash(
  p_article_id UUID,
  p_montant NUMERIC,
  p_quantite NUMERIC DEFAULT 1,
  p_date_vente DATE DEFAULT CURRENT_DATE,
  p_agent_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT 'Vente'
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_sale_id UUID;
  v_transaction_id UUID;
  v_article_record RECORD;
  v_agent_record RECORD;
  v_numero TEXT;
  v_meta JSONB;
BEGIN
  -- Get article details
  SELECT nom INTO v_article_record
  FROM public.articles
  WHERE id = p_article_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article introuvable';
  END IF;
  
  -- Get agent details if provided
  IF p_agent_id IS NOT NULL THEN
    SELECT nom, prenom INTO v_agent_record
    FROM public.agents_recouvrement
    WHERE id = p_agent_id;
  END IF;

  -- Record cash transaction (does NOT impact physical cash balance)
  v_transaction_id := public.record_cash_transaction(
    p_type_transaction := 'entree',
    p_montant := p_montant,
    p_type_operation := 'vente',
    p_agent_id := p_agent_id,
    p_beneficiaire := 'Entreprise',
    p_reference_operation := NULL,
    p_description := p_description || ' - ' || v_article_record.nom,
    p_piece_justificative := NULL
  );

  -- Record the sale
  INSERT INTO public.ventes (
    article_id,
    montant,
    quantite,
    date_vente,
    agent_id,
    cash_transaction_id,
    description
  ) VALUES (
    p_article_id,
    p_montant,
    p_quantite,
    p_date_vente,
    p_agent_id,
    v_transaction_id,
    p_description
  ) RETURNING id INTO v_sale_id;

  -- Generate receipt number
  v_numero := public.generate_receipt_number('vente');

  -- Prepare receipt metadata
  v_meta := jsonb_build_object(
    'client_name', NULL,
    'objet_type', 'vente',
    'objet_id', v_sale_id,
    'property_name', NULL,
    'reste_a_payer', 0,
    'statut', 'solde',
    'article_nom', v_article_record.nom,
    'quantite', p_quantite,
    'agent_nom', CASE 
      WHEN p_agent_id IS NOT NULL THEN COALESCE(v_agent_record.prenom, '') || ' ' || v_agent_record.nom
      ELSE NULL
    END
  );

  -- Create receipt
  INSERT INTO public.recus (
    numero,
    client_id,
    reference_id,
    type_operation,
    montant_total,
    date_generation,
    periode_debut,
    periode_fin,
    meta
  ) VALUES (
    v_numero,
    NULL,
    v_transaction_id,
    'vente',
    p_montant,
    p_date_vente,
    NULL,
    NULL,
    v_meta
  ) ON CONFLICT (type_operation, reference_id) DO NOTHING;

  RETURN v_sale_id;
END;
$function$;

-- Update record_cash_transaction to handle 'vente' without impacting physical cash
CREATE OR REPLACE FUNCTION public.record_cash_transaction(
  p_type_transaction text,
  p_montant numeric,
  p_type_operation text,
  p_agent_id uuid DEFAULT NULL::uuid,
  p_beneficiaire text DEFAULT NULL::text,
  p_reference_operation uuid DEFAULT NULL::uuid,
  p_description text DEFAULT NULL::text,
  p_piece_justificative text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction_id UUID;
  v_solde_avant NUMERIC;
  v_solde_apres NUMERIC;
  v_impacts_cash BOOLEAN;
BEGIN
  -- Current balance snapshot
  v_solde_avant := public.get_current_cash_balance();

  -- Physical cash (caisse versement) is impacted by:
  --   - Agent deposits (entree): cash coming into the physical box
  --   - Client payments (sortie): cash taken from the physical box for company
  --   - Caution payouts (sortie): cash going out to advance a caution
  -- Physical cash is NOT impacted by:
  --   - Company expenses (they use company balance)
  --   - Sales (they go directly to company revenue)
  v_impacts_cash := (
    p_type_transaction = 'entree' AND p_type_operation = 'versement_agent'
  ) OR (
    p_type_transaction = 'sortie' AND p_type_operation IN (
      'paiement_souscription', 
      'paiement_loyer', 
      'paiement_droit_terre', 
      'paiement_caution'
    )
  );

  -- Calculate new balance only if it impacts physical cash
  IF v_impacts_cash THEN
    IF p_type_transaction = 'entree' THEN
      v_solde_apres := v_solde_avant + p_montant;
    ELSE -- sortie
      v_solde_apres := v_solde_avant - p_montant;
    END IF;
  ELSE
    -- Non-cash impacting operations keep the same balance
    v_solde_apres := v_solde_avant;
  END IF;

  -- Insert the transaction record with balance snapshot
  INSERT INTO public.cash_transactions (
    type_transaction,
    montant,
    type_operation,
    agent_id,
    beneficiaire,
    reference_operation,
    description,
    piece_justificative,
    solde_avant,
    solde_apres
  ) VALUES (
    p_type_transaction,
    p_montant,
    p_type_operation,
    p_agent_id,
    p_beneficiaire,
    p_reference_operation,
    p_description,
    p_piece_justificative,
    v_solde_avant,
    v_solde_apres
  ) RETURNING id INTO v_transaction_id;

  -- Update the cash balance ONLY when the operation impacts physical cash
  IF v_impacts_cash THEN
    UPDATE public.caisse_balance 
    SET solde_courant = v_solde_apres,
        derniere_maj = now(),
        updated_at = now()
    WHERE id = (SELECT id FROM public.caisse_balance ORDER BY updated_at DESC LIMIT 1);
  END IF;

  RETURN v_transaction_id;
END;
$function$;

-- Add trigger for updated_at on articles
CREATE TRIGGER update_articles_updated_at
BEFORE UPDATE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on ventes
CREATE TRIGGER update_ventes_updated_at
BEFORE UPDATE ON public.ventes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();