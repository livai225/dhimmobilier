-- Create agents de recouvrement table
CREATE TABLE public.agents_recouvrement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  code_agent TEXT UNIQUE NOT NULL,
  statut TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'suspendu')),
  date_embauche DATE NOT NULL DEFAULT CURRENT_DATE,
  salaire_base NUMERIC DEFAULT 0,
  commission_pourcentage NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cash transactions table
CREATE TABLE public.cash_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_transaction TEXT NOT NULL CHECK (type_transaction IN ('entree', 'sortie')),
  montant NUMERIC NOT NULL CHECK (montant > 0),
  date_transaction DATE NOT NULL DEFAULT CURRENT_DATE,
  heure_transaction TIME NOT NULL DEFAULT CURRENT_TIME,
  type_operation TEXT NOT NULL CHECK (type_operation IN ('versement_agent', 'paiement_loyer', 'paiement_droit_terre', 'paiement_souscription', 'depense_entreprise', 'autre')),
  agent_id UUID REFERENCES public.agents_recouvrement(id),
  beneficiaire TEXT,
  reference_operation UUID,
  description TEXT,
  piece_justificative TEXT,
  solde_avant NUMERIC NOT NULL,
  solde_apres NUMERIC NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create caisse balance table for current balance tracking
CREATE TABLE public.caisse_balance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solde_courant NUMERIC NOT NULL DEFAULT 0,
  derniere_maj TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert initial balance record
INSERT INTO public.caisse_balance (solde_courant) VALUES (0);

-- Enable RLS on all tables
ALTER TABLE public.agents_recouvrement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisse_balance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing all access for now - will be refined with authentication)
CREATE POLICY "Allow all access to agents_recouvrement" ON public.agents_recouvrement FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to cash_transactions" ON public.cash_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to caisse_balance" ON public.caisse_balance FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for justificatifs
INSERT INTO storage.buckets (id, name, public) VALUES ('justificatifs', 'justificatifs', false);

-- Create storage policies for justificatifs
CREATE POLICY "Allow all access to justificatifs" ON storage.objects FOR ALL USING (bucket_id = 'justificatifs') WITH CHECK (bucket_id = 'justificatifs');

-- Function to get current cash balance
CREATE OR REPLACE FUNCTION public.get_current_cash_balance()
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  SELECT solde_courant INTO current_balance
  FROM public.caisse_balance
  ORDER BY updated_at DESC
  LIMIT 1;
  
  RETURN COALESCE(current_balance, 0);
END;
$$;

-- Function to check if payment is possible
CREATE OR REPLACE FUNCTION public.can_make_payment(amount NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN public.get_current_cash_balance() >= amount;
END;
$$;

-- Function to record cash transaction
CREATE OR REPLACE FUNCTION public.record_cash_transaction(
  p_type_transaction TEXT,
  p_montant NUMERIC,
  p_type_operation TEXT,
  p_agent_id UUID DEFAULT NULL,
  p_beneficiaire TEXT DEFAULT NULL,
  p_reference_operation UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_piece_justificative TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction_id UUID;
  v_solde_avant NUMERIC;
  v_solde_apres NUMERIC;
BEGIN
  -- Get current balance
  v_solde_avant := public.get_current_cash_balance();
  
  -- Calculate new balance
  IF p_type_transaction = 'entree' THEN
    v_solde_apres := v_solde_avant + p_montant;
  ELSIF p_type_transaction = 'sortie' THEN
    -- Check if sufficient funds
    IF v_solde_avant < p_montant THEN
      RAISE EXCEPTION 'Solde insuffisant. Solde actuel: %, Montant demandé: %', v_solde_avant, p_montant;
    END IF;
    v_solde_apres := v_solde_avant - p_montant;
  ELSE
    RAISE EXCEPTION 'Type de transaction invalide: %', p_type_transaction;
  END IF;
  
  -- Insert transaction
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
  
  -- Update balance
  UPDATE public.caisse_balance 
  SET solde_courant = v_solde_apres, 
      derniere_maj = now(),
      updated_at = now()
  WHERE id = (SELECT id FROM public.caisse_balance ORDER BY updated_at DESC LIMIT 1);
  
  RETURN v_transaction_id;
END;
$$;

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_agents_recouvrement_updated_at
  BEFORE UPDATE ON public.agents_recouvrement
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_caisse_balance_updated_at
  BEFORE UPDATE ON public.caisse_balance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate agent statistics
CREATE OR REPLACE FUNCTION public.get_agent_statistics(agent_uuid UUID, start_date DATE DEFAULT NULL, end_date DATE DEFAULT NULL)
RETURNS TABLE (
  total_verse NUMERIC,
  nombre_versements INTEGER,
  moyenne_versement NUMERIC,
  dernier_versement DATE
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(ct.montant), 0) as total_verse,
    COUNT(ct.id)::INTEGER as nombre_versements,
    COALESCE(AVG(ct.montant), 0) as moyenne_versement,
    MAX(ct.date_transaction) as dernier_versement
  FROM public.cash_transactions ct
  WHERE ct.agent_id = agent_uuid
    AND ct.type_transaction = 'entree'
    AND ct.type_operation = 'versement_agent'
    AND (start_date IS NULL OR ct.date_transaction >= start_date)
    AND (end_date IS NULL OR ct.date_transaction <= end_date);
END;
$$;