import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, RefreshCw, Zap } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReceiptIntegrityChecker, MissingReceipt } from "@/utils/receiptIntegrity";
import { useToast } from "@/hooks/use-toast";

export default function ReceiptIntegrityPage() {
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: missingReceipts, isLoading, refetch } = useQuery({
    queryKey: ["missing-receipts"],
    queryFn: ReceiptIntegrityChecker.checkMissingReceipts,
    enabled: false
  });

  const generateMissingMutation = useMutation({
    mutationFn: ReceiptIntegrityChecker.generateMissingReceipts,
    onSuccess: (result) => {
      toast({
        title: "Génération terminée",
        description: `${result.success} reçus générés avec succès. ${result.errors.length} erreurs.`,
        variant: result.errors.length > 0 ? "destructive" : "default"
      });
      queryClient.invalidateQueries({ queryKey: ["recus"] });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la génération des reçus",
        variant: "destructive"
      });
    }
  });

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      await refetch();
    } finally {
      setIsChecking(false);
    }
  };

  const handleGenerateAll = () => {
    generateMissingMutation.mutate();
  };

  const getTypeLabel = (type: string) => {
    const types = {
      location: "Paiement de loyer",
      souscription: "Apport de location", 
      facture: "Paiement de facture",
      droit_terre: "Droit de terre"
    };
    return types[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      location: "bg-blue-500",
      souscription: "bg-purple-500",
      facture: "bg-red-500", 
      droit_terre: "bg-orange-500"
    };
    return colors[type] || "bg-gray-500";
  };

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Intégrité des Reçus</h1>
          <p className="text-muted-foreground">
            Vérification et correction automatique des reçus manquants
          </p>
        </div>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Actions
          </CardTitle>
          <CardDescription>
            Vérifiez l'intégrité du système de reçus et corrigez automatiquement les problèmes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={handleCheck}
              disabled={isChecking || isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? "Vérification..." : "Vérifier l'intégrité"}
            </Button>
            
            {missingReceipts && missingReceipts.length > 0 && (
              <Button 
                onClick={handleGenerateAll}
                disabled={generateMissingMutation.isPending}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                {generateMissingMutation.isPending ? "Génération..." : `Générer ${missingReceipts.length} reçus`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      {missingReceipts !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {missingReceipts.length === 0 ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Système Intègre
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Problèmes Détectés
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {missingReceipts.length === 0 ? (
              <p className="text-green-600">
                ✅ Tous les paiements ont des reçus correspondants. Le système est intègre.
              </p>
            ) : (
              <p className="text-amber-600">
                ⚠️ {missingReceipts.length} paiement(s) sans reçu détecté(s). Cliquez sur "Générer" pour les corriger automatiquement.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Missing Receipts Table */}
      {missingReceipts && missingReceipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reçus Manquants</CardTitle>
            <CardDescription>
              Liste des paiements qui n'ont pas de reçus correspondants
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingReceipts.map((missing) => (
                    <TableRow key={missing.id}>
                      <TableCell>
                        <Badge className={`${getTypeColor(missing.type)} text-white text-xs`}>
                          {getTypeLabel(missing.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(missing.date).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {missing.amount.toLocaleString("fr-FR")} FCFA
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {missing.referenceId.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-xs">
                          Reçu manquant
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Comment ça fonctionne</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Vérification automatique</h4>
            <p className="text-sm text-muted-foreground">
              Le système vérifie tous les paiements (locations, souscriptions, factures, droits de terre) 
              et identifie ceux qui n'ont pas de reçus correspondants.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">2. Génération automatique</h4>
            <p className="text-sm text-muted-foreground">
              Les reçus manquants peuvent être générés automatiquement avec les bonnes informations 
              (numéro, date, montant, client, etc.).
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">3. Intégrité future</h4>
            <p className="text-sm text-muted-foreground">
              Tous les nouveaux paiements génèrent automatiquement des reçus. 
              Cette page permet de corriger les données historiques.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}