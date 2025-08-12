import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface FactureDetailsDialogProps {
  facture: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FactureDetailsDialog({ facture, open, onOpenChange }: FactureDetailsDialogProps) {
  const { data: paiements = [] } = useQuery({
    queryKey: ["paiements_facture_details", facture?.id],
    queryFn: async () => {
      if (!facture?.id) return [];
      const { data, error } = await supabase
        .from("paiements_factures")
        .select("*")
        .eq("facture_id", facture.id)
        .order("date_paiement", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!facture?.id && open,
  });

  if (!facture) return null;

  const formatCurrency = (amount?: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", minimumFractionDigits: 0 }).format(Number(amount || 0));

  const getStatutBadge = () => {
    const solde = facture.solde || 0;
    const montantTotal = facture.montant_total || 0;
    if (solde < -0.01) return <Badge className="bg-red-100 text-red-800">Erreur</Badge>;
    if (Math.abs(solde) <= 0.01) return <Badge>Payée</Badge>;
    if (solde < montantTotal) return <Badge variant="secondary">Partielle</Badge>;
    return <Badge variant="destructive">Impayée</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Détails de la facture</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>N°</span><span className="font-medium">{facture.numero}</span></div>
              <div className="flex justify-between"><span>Fournisseur</span><span className="font-medium">{facture.fournisseur?.nom}</span></div>
              <div className="flex justify-between"><span>Propriété</span><span className="font-medium">{facture.propriete?.nom || "-"}</span></div>
              <div className="flex justify-between"><span>Date</span><span className="font-medium">{format(new Date(facture.date_facture), "dd/MM/yyyy", { locale: fr })}</span></div>
              <div className="flex justify-between"><span>Statut</span><span>{getStatutBadge()}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Montants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Total</span><span className="font-bold">{formatCurrency(facture.montant_total)}</span></div>
              <div className="flex justify-between"><span>Payé</span><span className="font-medium">{formatCurrency(facture.montant_paye)}</span></div>
              <div className={`flex justify-between ${facture.solde < 0 ? 'text-red-600' : ''}`}><span>Solde</span><span className="font-medium">{formatCurrency(facture.solde)}</span></div>
              {facture.description && (
                <div className="pt-2">
                  <div className="text-xs text-muted-foreground">Description</div>
                  <div>{facture.description}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Historique des paiements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {paiements.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucun paiement</div>
            ) : (
              paiements.map((p: any) => (
                <div key={p.id} className="flex justify-between border rounded-md p-2 text-sm">
                  <div>
                    <div className="font-medium">{formatCurrency(p.montant)}</div>
                    <div className="text-muted-foreground">{format(new Date(p.date_paiement), "dd/MM/yyyy", { locale: fr })}</div>
                    {p.reference && <div className="text-xs text-muted-foreground">Réf: {p.reference}</div>}
                  </div>
                  <div className="text-right">{p.mode_paiement}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
