-- Update the receipt creation function for invoice payments to include supplier information
CREATE OR REPLACE FUNCTION public.tg_create_receipt_paiement_facture()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_facture record;
  v_fournisseur record;
  v_total_paye numeric;
  v_remaining numeric;
  v_status text;
  v_meta jsonb;
  v_numero text;
BEGIN
  -- Get invoice and supplier details
  SELECT f.*, p.nom AS propriete_nom, fr.nom AS fournisseur_nom, 
         fr.contact AS fournisseur_contact, fr.telephone AS fournisseur_telephone,
         fr.email AS fournisseur_email
  INTO v_facture
  FROM public.factures_fournisseurs f
  LEFT JOIN public.proprietes p ON p.id = f.propriete_id
  JOIN public.fournisseurs fr ON fr.id = f.fournisseur_id
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
    'statut', v_status,
    'fournisseur_nom', v_facture.fournisseur_nom,
    'fournisseur_contact', v_facture.fournisseur_contact,
    'fournisseur_telephone', v_facture.fournisseur_telephone,
    'fournisseur_email', v_facture.fournisseur_email,
    'facture_numero', v_facture.numero,
    'facture_description', v_facture.description,
    'facture_montant_total', v_facture.montant_total
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