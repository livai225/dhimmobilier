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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
      const { error } = await supabase
        .from("paiements_factures")
        .insert({
          facture_id: facture.id,
          montant: data.montant,
          date_paiement: data.date_paiement,
          mode_paiement: data.mode_paiement || null,
          reference: data.reference || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["factures"] });
      queryClient.invalidateQueries({ queryKey: ["paiements"] });
      form.reset();
      toast({
        title: "Succès",
        description: "Paiement enregistré avec succès",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement du paiement",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PaiementFormData) => {
    // Validate that payment doesn't exceed remaining balance
    if (data.montant > (facture?.solde || 0)) {
      toast({
        title: "Erreur",
        description: "Le montant ne peut pas dépasser le solde restant",
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Paiement de facture - {facture.numero}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="nouveau" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="nouveau">Nouveau paiement</TabsTrigger>
            <TabsTrigger value="historique">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="nouveau" className="space-y-4">
            {/* Invoice info */}
            <div className="bg-muted p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
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
                  <p className="font-bold text-destructive">{formatCurrency(facture.solde)}</p>
                </div>
              </div>
            </div>

            {/* Payment form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="mode_paiement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mode de paiement</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionnez un mode" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="espece">Espèces</SelectItem>
                            <SelectItem value="cheque">Chèque</SelectItem>
                            <SelectItem value="virement">Virement</SelectItem>
                            <SelectItem value="mobile_money">Mobile Money</SelectItem>
                            <SelectItem value="carte">Carte bancaire</SelectItem>
                          </SelectContent>
                        </Select>
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

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Enregistrement..." : "Enregistrer le paiement"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="historique">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Référence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paiements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Aucun paiement enregistré
                      </TableCell>
                    </TableRow>
                  ) : (
                    paiements.map((paiement) => (
                      <TableRow key={paiement.id}>
                        <TableCell>
                          {format(new Date(paiement.date_paiement), "dd/MM/yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(paiement.montant)}
                        </TableCell>
                        <TableCell>{paiement.mode_paiement || "-"}</TableCell>
                        <TableCell>{paiement.reference || "-"}</TableCell>
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