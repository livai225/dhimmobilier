import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { ReceiptGenerator } from "@/utils/receiptGenerator";

const paiementSchema = z.object({
  montant: z.number().min(0.01, "Le montant doit être supérieur à 0"),
  date_paiement: z.string().min(1, "La date est requise"),
  mode_paiement: z.string().optional(),
  reference: z.string().optional(),
});

type PaiementFormData = z.infer<typeof paiementSchema>;

interface PaiementFactureDialogProps {
  facture: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PaiementFactureDialog({ 
  facture, 
  open, 
  onOpenChange, 
  onSuccess 
}: PaiementFactureDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<PaiementFormData>({
    resolver: zodResolver(paiementSchema),
    defaultValues: {
      montant: 0,
      date_paiement: new Date().toISOString().split('T')[0],
      mode_paiement: "",
      reference: "",
    },
  });

  // Fetch payment history
  const { data: paiements = [] } = useQuery({
    queryKey: ["paiements", facture?.id],
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
    enabled: !!facture?.id,
  });

  // Create payment mutation
  const mutation = useMutation({
    mutationFn: async (data: PaiementFormData) => {
      const { data: payment, error } = await supabase
        .from("paiements_factures")
        .insert({
          facture_id: facture.id,
          montant: data.montant,
          date_paiement: data.date_paiement,
          mode_paiement: data.mode_paiement || null,
          reference: data.reference || null,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Generate receipt for invoice payment
      const receipt = await ReceiptGenerator.createReceipt({
        clientId: "00000000-0000-0000-0000-000000000000", // Client système pour les factures
        referenceId: payment.id,
        typeOperation: "paiement_facture",
        montantTotal: data.montant,
        datePaiement: data.date_paiement
      });

      return { payment, receipt };
    },
    onSuccess: ({ receipt }) => {
      queryClient.invalidateQueries({ queryKey: ["factures"] });
      queryClient.invalidateQueries({ queryKey: ["paiements"] });
      queryClient.invalidateQueries({ queryKey: ["recus"] }); // Invalider les reçus
      form.reset();
      toast({
        title: "Succès",
        description: `Paiement enregistré avec succès. Reçu généré: ${receipt.numero}`,
      });
      onSuccess();
    },
    onError: (error: Error) => {
      let errorMessage = error.message;
      
      // Améliorer les messages d'erreur de la base de données
      if (errorMessage.includes('dépasse le solde restant')) {
        const matches = errorMessage.match(/Montant total: ([\d.]+), Déjà payé: ([\d.]+), Solde restant: ([\d.]+)/);
        if (matches) {
          const [, total, paye, restant] = matches;
          errorMessage = `Paiement impossible: le solde restant est de ${formatCurrency(Number(restant))} (Total: ${formatCurrency(Number(total))}, Payé: ${formatCurrency(Number(paye))})`;
        }
      }
      
      toast({
        title: "Erreur de paiement",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: PaiementFormData) => {
    if (!facture) return;

    // Recalcul du montant restant en temps réel pour éviter les conditions de course
    const { data: paiementsExistants } = await supabase
      .from('paiements_factures')
      .select('montant')
      .eq('facture_id', facture.id);

    const totalPaye = paiementsExistants?.reduce((sum, p) => sum + Number(p.montant), 0) || 0;
    const montantRestant = facture.montant_total - totalPaye;
    
    // Validation stricte avec marge d'erreur numérique
    if (data.montant > montantRestant + 0.01) {
      toast({
        title: "Montant invalide",
        description: `Le montant saisi (${formatCurrency(data.montant)}) dépasse le solde restant de ${formatCurrency(montantRestant)}`,
        variant: "destructive",
      });
      return;
    }

    // Validation de montant positif
    if (data.montant <= 0) {
      toast({
        title: "Montant invalide",
        description: "Le montant doit être supérieur à zéro",
        variant: "destructive",
      });
      return;
    }

    mutation.mutate(data);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const handleMaxAmount = () => {
    form.setValue('montant', facture?.solde || 0);
  };

  if (!facture) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paiement de facture - {facture.numero}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="nouveau" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="nouveau" className="text-xs sm:text-sm">Nouveau paiement</TabsTrigger>
            <TabsTrigger value="historique" className="text-xs sm:text-sm">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="nouveau" className="space-y-4">
            {/* Invoice info */}
            <div className="bg-muted p-4 rounded-lg">
              {facture.solde < 0 && (
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Attention: Cette facture a un solde négatif de {formatCurrency(Math.abs(facture.solde))}. 
                    Contactez l'administrateur pour corriger cette situation.
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Fournisseur</p>
                  <p className="font-medium">{facture.fournisseur?.nom}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date facture</p>
                  <p className="font-medium">
                    {format(new Date(facture.date_facture), "dd/MM/yyyy", { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Montant total</p>
                  <p className="font-medium">{formatCurrency(facture.montant_total)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Solde restant</p>
                  <p className={`font-bold ${facture.solde < 0 ? 'text-red-600' : 'text-destructive'}`}>
                    {formatCurrency(facture.solde)}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="montant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montant à payer (FCFA) *</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              max={facture.solde}
                              step="1"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={handleMaxAmount}
                            size="sm"
                          >
                            Max
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date_paiement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de paiement *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="mode_paiement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mode de paiement</FormLabel>
                        <FormControl>
                          <Combobox
                            options={[
                              { value: "espece", label: "Espèces" },
                              { value: "cheque", label: "Chèque" },
                              { value: "virement", label: "Virement" },
                              { value: "mobile_money", label: "Mobile Money" },
                              { value: "carte", label: "Carte bancaire" }
                            ]}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Sélectionnez un mode"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Référence</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="N° chèque, réf. virement..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                    Annuler
                  </Button>
                  <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto">
                    {mutation.isPending ? "Enregistrement..." : "Enregistrer le paiement"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="historique">
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Date</TableHead>
                    <TableHead className="text-xs sm:text-sm">Montant</TableHead>
                    <TableHead className="text-xs sm:text-sm">Mode</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Référence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paiements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Aucun paiement enregistré
                      </TableCell>
                    </TableRow>
                  ) : (
                    paiements.map((paiement) => (
                      <TableRow key={paiement.id}>
                        <TableCell className="text-xs sm:text-sm">
                          {format(new Date(paiement.date_paiement), "dd/MM/yy", { locale: fr })}
                        </TableCell>
                        <TableCell className="font-medium text-xs sm:text-sm">
                          {formatCurrency(paiement.montant)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          {paiement.mode_paiement ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                              {paiement.mode_paiement === 'espece' ? 'Espèces' :
                               paiement.mode_paiement === 'cheque' ? 'Chèque' :
                               paiement.mode_paiement === 'virement' ? 'Virement' :
                               paiement.mode_paiement === 'mobile_money' ? 'Mobile Money' :
                               paiement.mode_paiement === 'carte' ? 'Carte bancaire' :
                               paiement.mode_paiement}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{paiement.reference || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}