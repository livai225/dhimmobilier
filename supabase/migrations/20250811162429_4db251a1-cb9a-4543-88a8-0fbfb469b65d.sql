-- Ensure trigger to update subscription remaining balance after payments
DROP TRIGGER IF EXISTS trg_update_souscription_solde ON public.paiements_souscriptions;
CREATE TRIGGER trg_update_souscription_solde
AFTER INSERT OR UPDATE ON public.paiements_souscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_souscription_solde();