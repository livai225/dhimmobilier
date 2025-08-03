-- Créer les tables principales
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.types_proprietes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.proprietes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  adresse TEXT,
  type_id UUID REFERENCES public.types_proprietes(id),
  surface DECIMAL,
  prix_achat DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.fournisseurs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  contact TEXT,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.factures_fournisseurs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  fournisseur_id UUID REFERENCES public.fournisseurs(id) NOT NULL,
  propriete_id UUID REFERENCES public.proprietes(id),
  montant_total DECIMAL NOT NULL DEFAULT 0,
  montant_paye DECIMAL NOT NULL DEFAULT 0,
  solde DECIMAL NOT NULL DEFAULT 0,
  date_facture DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.paiements_factures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facture_id UUID REFERENCES public.factures_fournisseurs(id) NOT NULL,
  montant DECIMAL NOT NULL,
  date_paiement DATE NOT NULL,
  mode_paiement TEXT,
  reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.souscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) NOT NULL,
  propriete_id UUID REFERENCES public.proprietes(id) NOT NULL,
  prix_total DECIMAL NOT NULL,
  apport_initial DECIMAL NOT NULL DEFAULT 0,
  montant_mensuel DECIMAL NOT NULL,
  nombre_mois INTEGER NOT NULL,
  date_debut DATE NOT NULL,
  statut TEXT NOT NULL DEFAULT 'active',
  solde_restant DECIMAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) NOT NULL,
  propriete_id UUID REFERENCES public.proprietes(id) NOT NULL,
  loyer_mensuel DECIMAL NOT NULL,
  caution DECIMAL NOT NULL DEFAULT 0,
  date_debut DATE NOT NULL,
  date_fin DATE,
  statut TEXT NOT NULL DEFAULT 'active',
  dette_totale DECIMAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.paiements_souscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  souscription_id UUID REFERENCES public.souscriptions(id) NOT NULL,
  montant DECIMAL NOT NULL,
  date_paiement DATE NOT NULL,
  mode_paiement TEXT,
  reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.paiements_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES public.locations(id) NOT NULL,
  montant DECIMAL NOT NULL,
  date_paiement DATE NOT NULL,
  mode_paiement TEXT,
  reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.recus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id) NOT NULL,
  type_operation TEXT NOT NULL, -- 'souscription' ou 'location'
  reference_id UUID NOT NULL, -- ID de la souscription ou location
  montant_total DECIMAL NOT NULL,
  periode_debut DATE,
  periode_fin DATE,
  date_generation DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insérer les types de propriétés prédéfinis
INSERT INTO public.types_proprietes (nom, description) VALUES
('Studio', 'Logement d''une pièce principale'),
('Appartement F2', 'Logement de 2 pièces principales'),
('Appartement F3', 'Logement de 3 pièces principales'),
('Appartement F4', 'Logement de 4 pièces principales'),
('Villa', 'Maison individuelle avec jardin'),
('Duplex', 'Logement sur deux niveaux'),
('Commerce', 'Local commercial'),
('Bureau', 'Espace de bureau');

-- Activer RLS sur toutes les tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.types_proprietes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proprietes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures_fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements_factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.souscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements_souscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recus ENABLE ROW LEVEL SECURITY;

-- Créer des politiques RLS simples (accès pour utilisateurs authentifiés)
CREATE POLICY "Authenticated users can access clients" ON public.clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access types_proprietes" ON public.types_proprietes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access proprietes" ON public.proprietes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access fournisseurs" ON public.fournisseurs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access factures_fournisseurs" ON public.factures_fournisseurs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access paiements_factures" ON public.paiements_factures FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access souscriptions" ON public.souscriptions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access locations" ON public.locations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access paiements_souscriptions" ON public.paiements_souscriptions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access paiements_locations" ON public.paiements_locations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access recus" ON public.recus FOR ALL USING (auth.role() = 'authenticated');

-- Créer une fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers pour updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_proprietes_updated_at BEFORE UPDATE ON public.proprietes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fournisseurs_updated_at BEFORE UPDATE ON public.fournisseurs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_factures_fournisseurs_updated_at BEFORE UPDATE ON public.factures_fournisseurs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_souscriptions_updated_at BEFORE UPDATE ON public.souscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fonction pour calculer le solde des factures
CREATE OR REPLACE FUNCTION public.calculate_facture_solde()
RETURNS TRIGGER AS $$
BEGIN
  NEW.solde = NEW.montant_total - NEW.montant_paye;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour calculer automatiquement le solde des factures
CREATE TRIGGER calculate_facture_solde_trigger 
BEFORE INSERT OR UPDATE ON public.factures_fournisseurs 
FOR EACH ROW EXECUTE FUNCTION public.calculate_facture_solde();

-- Fonction pour calculer la dette des locations
CREATE OR REPLACE FUNCTION public.calculate_location_dette()
RETURNS TRIGGER AS $$
DECLARE
  total_paye DECIMAL;
  mois_ecoules INTEGER;
  montant_du DECIMAL;
BEGIN
  -- Calculer le nombre de mois écoulés depuis le début
  mois_ecoules = EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.date_debut)) * 12 + 
                 EXTRACT(MONTH FROM AGE(CURRENT_DATE, NEW.date_debut));
  
  -- Calculer le montant total payé pour cette location
  SELECT COALESCE(SUM(montant), 0) INTO total_paye
  FROM public.paiements_locations 
  WHERE location_id = NEW.id;
  
  -- Calculer le montant dû (loyer mensuel * mois écoulés)
  montant_du = NEW.loyer_mensuel * mois_ecoules;
  
  -- Calculer la dette (montant dû - montant payé)
  NEW.dette_totale = GREATEST(0, montant_du - total_paye);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour calculer automatiquement la dette des locations
CREATE TRIGGER calculate_location_dette_trigger 
BEFORE INSERT OR UPDATE ON public.locations 
FOR EACH ROW EXECUTE FUNCTION public.calculate_location_dette();