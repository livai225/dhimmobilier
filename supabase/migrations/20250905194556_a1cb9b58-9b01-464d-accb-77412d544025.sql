-- Update existing invoice payment receipts with supplier information
UPDATE public.recus 
SET meta = meta || jsonb_build_object(
  'fournisseur_nom', fr.nom,
  'fournisseur_contact', fr.contact,
  'fournisseur_telephone', fr.telephone,
  'fournisseur_email', fr.email,
  'facture_numero', f.numero,
  'facture_description', f.description,
  'facture_montant_total', f.montant_total
)
FROM public.paiements_factures pf
JOIN public.factures_fournisseurs f ON pf.facture_id = f.id
JOIN public.fournisseurs fr ON f.fournisseur_id = fr.id
WHERE public.recus.reference_id = pf.id 
AND public.recus.type_operation = 'paiement_facture'
AND public.recus.meta ->> 'fournisseur_nom' IS NULL;