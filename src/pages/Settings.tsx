import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trash2, Download, Settings as SettingsIcon, Database, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImportClientsFromExcel } from "@/components/ImportClientsFromExcel";
import { DuplicateClientManager } from "@/components/DuplicateClientManager";
import { MissingReceiptsRecovery } from "@/components/MissingReceiptsRecovery";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProtectedAction } from "@/components/ProtectedAction";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");
  const [confirmClientText, setConfirmClientText] = useState("");
  const [confirmAllText, setConfirmAllText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  const clearFinancialData = useMutation({
    mutationFn: async () => {
      setIsLoading(true);
      
      // Supprimer toutes les données financières dans l'ordre correct
      await supabase.from('paiements_factures').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('paiements_locations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('paiements_souscriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('paiements_droit_terre').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('echeances_droit_terre').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('cash_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('recus').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('factures_fournisseurs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('locations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('souscriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Réinitialiser le solde caisse
      const { error: balanceError } = await supabase
        .from('caisse_balance')
        .update({ solde_courant: 0, derniere_maj: new Date().toISOString() })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (balanceError) throw balanceError;
    },
    onSuccess: () => {
      setConfirmText("");
      setIsLoading(false);
      queryClient.invalidateQueries();
      toast({
        title: "✅ Données supprimées",
        description: "Toutes les données financières ont été supprimées. Les clients et propriétés sont conservés.",
      });
    },
    onError: (error: any) => {
      setIsLoading(false);
      toast({
        title: "❌ Erreur",
        description: error.message || "Impossible de supprimer les données",
        variant: "destructive",
      });
    },
  });

  const clearAllData = useMutation({
    mutationFn: async () => {
      setIsLoadingAll(true);
      
      // Supprimer TOUTES les données dans l'ordre correct (dépendances)
      await supabase.from('ventes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('recus').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('paiements_factures').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('paiements_locations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('paiements_souscriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('paiements_droit_terre').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('echeances_droit_terre').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('cash_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('factures_fournisseurs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('locations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('souscriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('proprietes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('fournisseurs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('agents_recouvrement').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('articles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('types_proprietes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('secteurs_activite').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('bareme_droits_terre').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('receipt_counters').delete().neq('date_key', '1900-01-01');

      // Réinitialiser le solde caisse à zéro
      const { error: balanceError } = await supabase
        .from('caisse_balance')
        .update({ solde_courant: 0, derniere_maj: new Date().toISOString() })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (balanceError) throw balanceError;
    },
    onSuccess: () => {
      setConfirmAllText("");
      setIsLoadingAll(false);
      queryClient.invalidateQueries();
      toast({
        title: "✅ Base de données vidée",
        description: "Toutes les données ont été supprimées. Seuls les utilisateurs sont conservés.",
      });
    },
    onError: (error: any) => {
      setIsLoadingAll(false);
      toast({
        title: "❌ Erreur",
        description: error.message || "Impossible de vider la base de données",
        variant: "destructive",
      });
    },
  });

  const clearAllClients = useMutation({
    mutationFn: async () => {
      setIsLoadingClients(true);
      
      // Supprimer tous les clients - vérifier d'abord s'il y a des relations
      const { count } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });
      
      // Supprimer tous les clients
      const { error } = await supabase
        .from('clients')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) throw error;
      
      return count;
    },
    onSuccess: (deletedCount) => {
      setConfirmClientText("");
      setIsLoadingClients(false);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: "✅ Clients supprimés",
        description: `Tous les clients (${deletedCount}) ont été supprimés avec succès.`,
      });
    },
    onError: (error: any) => {
      setIsLoadingClients(false);
      toast({
        title: "❌ Erreur",
        description: error.message || "Impossible de supprimer les clients",
        variant: "destructive",
      });
    },
  });

  const canDelete = confirmText === "SUPPRIMER TOUT";
  const canDeleteClients = confirmClientText === "SUPPRIMER TOUS LES CLIENTS";
  const canDeleteAll = confirmAllText === "VIDER COMPLETEMENT LA BASE";

  return (
    <ProtectedAction permission="isAdmin" showMessage={true}>
      <div className="container mx-auto p-4 lg:p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <SettingsIcon className="w-8 h-8" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">Configuration et gestion des données</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Données système */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Database className="w-5 h-5" />
              Informations système
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium">Base de données</p>
                <Badge variant="secondary">Supabase PostgreSQL</Badge>
              </div>
              <div>
                <p className="font-medium">Statut</p>
                <Badge variant="default" className="bg-green-600">Connecté</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Import de données */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import de données
            </CardTitle>
            <CardDescription>
              Importez des données depuis des fichiers externes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Import de clients depuis Excel</h4>
              <ImportClientsFromExcel />
            </div>
          </CardContent>
        </Card>

        {/* Gestion des doublons */}
        <DuplicateClientManager />

        {/* Outils administrateur */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              Outils de récupération (Administrateur)
            </CardTitle>
            <CardDescription>
              Outils de diagnostic et de correction des données manquantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Récupération des reçus manquants</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Identifiez et générez automatiquement les reçus manqués lors d'imports précédents
                </p>
                <MissingReceiptsRecovery />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Zone dangereuse */}
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Zone dangereuse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Suppression complète de TOUTES les données */}
            <div className="bg-red-200 border-2 border-red-300 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-red-900 mb-2 text-lg">🔥 SUPPRESSION TOTALE DE LA BASE DE DONNÉES</h3>
              <p className="text-sm text-red-800 mb-3 font-medium">
                Cette action va supprimer <strong>ABSOLUMENT TOUTES</strong> les données de l'application.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="bg-red-100 border border-red-200 rounded p-3">
                  <h4 className="font-semibold text-red-800 mb-2">❌ SERA SUPPRIMÉ :</h4>
                  <ul className="text-xs text-red-700 space-y-1">
                    <li>• Tous les clients</li>
                    <li>• Toutes les propriétés</li>
                    <li>• Tous les fournisseurs</li>
                    <li>• Tous les agents</li>
                    <li>• Toutes les transactions</li>
                    <li>• Tous les paiements</li>
                    <li>• Tous les contrats</li>
                    <li>• Toutes les factures</li>
                    <li>• Tous les reçus</li>
                    <li>• Tous les paramètres métier</li>
                  </ul>
                </div>
                <div className="bg-green-100 border border-green-200 rounded p-3">
                  <h4 className="font-semibold text-green-800 mb-2">✅ SERA CONSERVÉ :</h4>
                  <ul className="text-xs text-green-700 space-y-1">
                    <li>• Comptes utilisateurs</li>
                    <li>• Permissions utilisateurs</li>
                    <li>• Logs d'audit système</li>
                  </ul>
                </div>
              </div>

              <div className="bg-yellow-100 border-2 border-yellow-300 rounded p-3 mb-4">
                <p className="text-sm text-yellow-800 font-bold">
                  ⚠️ ATTENTION : Cette action remet l'application à l'état d'installation initiale !<br/>
                  📁 EXPORTEZ VOS DONNÉES AVANT de continuer - cette action est DÉFINITIVE !
                </p>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-3">
                    <Trash2 className="w-4 h-4 mr-2" />
                    VIDER COMPLÈTEMENT LA BASE DE DONNÉES
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-lg border-2 border-red-300">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-700 text-lg">
                      🔥 SUPPRESSION TOTALE - CONFIRMATION REQUISE
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4">
                      <div className="bg-red-100 border border-red-300 rounded p-3">
                        <p className="font-bold text-red-800 mb-2">
                          ⚠️ VOUS ALLEZ SUPPRIMER DÉFINITIVEMENT :
                        </p>
                        <p className="text-sm text-red-700">
                          • Tous les clients, propriétés, fournisseurs, agents<br/>
                          • Toutes les transactions financières et paiements<br/>
                          • Tous les contrats, souscriptions et factures<br/>
                          • Tous les reçus et données métier<br/>
                          • Tous les paramètres de configuration
                        </p>
                      </div>
                      <p className="text-red-700 font-bold text-center">
                        CETTE ACTION EST IRRÉVERSIBLE !
                      </p>
                      <div>
                        <p className="text-sm mb-2 font-medium">
                          Pour confirmer, tapez exactement :<br/>
                          <strong>"VIDER COMPLETEMENT LA BASE"</strong>
                        </p>
                        <Input
                          value={confirmAllText}
                          onChange={(e) => setConfirmAllText(e.target.value)}
                          placeholder="VIDER COMPLETEMENT LA BASE"
                          className="font-mono text-sm border-red-300 focus:border-red-500"
                        />
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmAllText("")}>
                      Annuler
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearAllData.mutate()}
                      disabled={!canDeleteAll || isLoadingAll}
                      className="bg-red-700 hover:bg-red-800 font-bold"
                    >
                      {isLoadingAll ? "SUPPRESSION EN COURS..." : "CONFIRMER LA SUPPRESSION TOTALE"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="bg-red-100 border border-red-200 rounded-lg p-4 mb-4">
              <h3 className="font-medium text-red-800 mb-2">🗑️ Suppression de tous les clients</h3>
              <p className="text-sm text-red-700 mb-3">
                Cette action va supprimer <strong>tous les clients</strong> de la base de données.
              </p>
              <div className="bg-yellow-100 border border-yellow-200 rounded p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Attention :</strong> Utilisez cette fonction uniquement pour nettoyer avant un nouvel import.
                </p>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer tous les clients
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-600">
                      ⚠️ Suppression de tous les clients
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        Vous êtes sur le point de supprimer <strong>tous les clients</strong> de la base de données.
                      </p>
                      <p className="text-red-600 font-medium">
                        Cette action est IRRÉVERSIBLE !
                      </p>
                      <div>
                        <p className="text-sm mb-2">
                          Tapez <strong>"SUPPRIMER TOUS LES CLIENTS"</strong> pour confirmer :
                        </p>
                        <Input
                          value={confirmClientText}
                          onChange={(e) => setConfirmClientText(e.target.value)}
                          placeholder="SUPPRIMER TOUS LES CLIENTS"
                          className="font-mono text-sm"
                        />
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmClientText("")}>
                      Annuler
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearAllClients.mutate()}
                      disabled={!canDeleteClients || isLoadingClients}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isLoadingClients ? "Suppression..." : "Confirmer la suppression"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="bg-red-100 border border-red-200 rounded-lg p-4">
              <h3 className="font-medium text-red-800 mb-2">⚠️ Suppression des données financières</h3>
              <p className="text-sm text-red-700 mb-3">
                Cette action va supprimer <strong>toutes</strong> les données financières :
              </p>
              <ul className="text-sm text-red-700 space-y-1 mb-4 ml-4">
                <li>• Toutes les transactions de caisse</li>
                <li>• Tous les paiements (loyers, souscriptions, factures)</li>
                <li>• Toutes les factures fournisseurs</li>
                <li>• Tous les contrats de location</li>
                <li>• Toutes les souscriptions</li>
                <li>• Tous les reçus générés</li>
                <li>• L'historique financier complet</li>
              </ul>
              <div className="bg-green-100 border border-green-200 rounded p-3 mb-4">
                <p className="text-sm text-green-700">
                  ✅ <strong>Conservé :</strong> Clients, Propriétés, Fournisseurs, Agents
                </p>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer toutes les données financières
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-600">
                      ⚠️ Confirmation requise
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        Vous êtes sur le point de supprimer <strong>définitivement</strong> toutes les données financières.
                      </p>
                      <p className="text-red-600 font-medium">
                        Cette action est IRRÉVERSIBLE !
                      </p>
                      <div>
                        <p className="text-sm mb-2">
                          Tapez <strong>"SUPPRIMER TOUT"</strong> pour confirmer :
                        </p>
                        <Input
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          placeholder="SUPPRIMER TOUT"
                          className="font-mono"
                        />
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmText("")}>
                      Annuler
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearFinancialData.mutate()}
                      disabled={!canDelete || isLoading}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isLoading ? "Suppression..." : "Confirmer la suppression"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Sauvegarde */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Sauvegarde
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Avant toute suppression, nous recommandons fortement d'exporter vos données.
            </p>
            <Button variant="outline" disabled>
              <Download className="w-4 h-4 mr-2" />
              Exporter toutes les données (Prochainement)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
    </ProtectedAction>
  );
}