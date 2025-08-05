-- Create trigger on subscription payments
CREATE TRIGGER update_souscription_solde_after_payment
AFTER INSERT OR UPDATE OR DELETE ON public.paiements_souscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_souscription_solde();