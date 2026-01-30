import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Search, Users, Eye } from 'lucide-react';
import { apiClient } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface ClientPreview {
  nom: string;
  prenom: string;
  original: string;
}

interface ClientVerification {
  nom: string;
  prenom: string;
  original: string;
  status: 'nouveau' | 'doublon_exact' | 'doublon_probable';
  reason?: string;
  selected: boolean;
}

interface ImportResult {
  success: number;
  errors: string[];
  duplicates: number;
}

export const ImportClientsFromExcel = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<ClientPreview[]>([]);
  const [verificationList, setVerificationList] = useState<ClientVerification[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  // Fonction pour normaliser les noms pour la comparaison
  const normalizeName = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[ñ]/g, 'n')
      .replace(/\s+/g, ' ');
  };

  // Fonction pour détecter les doublons avec logique avancée
  const detectDuplicate = (nom: string, prenom: string, existingClients: any[]): { isDuplicate: boolean; status: ClientVerification['status']; reason?: string } => {
    const normalizedNom = normalizeName(nom);
    const normalizedPrenom = normalizeName(prenom || '');
    const fullName = `${normalizedNom} ${normalizedPrenom}`.trim();

    for (const existing of existingClients) {
      const existingNom = normalizeName(existing.nom);
      const existingPrenom = normalizeName(existing.prenom || '');
      const existingFullName = `${existingNom} ${existingPrenom}`.trim();

      // Doublon exact
      if (normalizedNom === existingNom && normalizedPrenom === existingPrenom) {
        return { 
          isDuplicate: true, 
          status: 'doublon_exact', 
          reason: `Identique à: ${existing.nom} ${existing.prenom || ''}`.trim()
        };
      }

      // Doublon probable - même nom complet
      if (fullName === existingFullName && fullName.length > 0) {
        return { 
          isDuplicate: true, 
          status: 'doublon_probable', 
          reason: `Nom complet similaire à: ${existing.nom} ${existing.prenom || ''}`.trim()
        };
      }

      // Doublon probable - nom identique avec prénom similaire
      if (normalizedNom === existingNom && normalizedPrenom && existingPrenom) {
        const prenomWords1 = normalizedPrenom.split(' ');
        const prenomWords2 = existingPrenom.split(' ');
        const commonWords = prenomWords1.filter(word => prenomWords2.includes(word));
        
        if (commonWords.length > 0) {
          return { 
            isDuplicate: true, 
            status: 'doublon_probable', 
            reason: `Nom identique avec prénom similaire: ${existing.nom} ${existing.prenom || ''}`.trim()
          };
        }
      }
    }

    return { isDuplicate: false, status: 'nouveau' };
  };

  const parseNameFromFullName = (fullName: string): { nom: string; prenom: string } => {
    if (!fullName || typeof fullName !== 'string') {
      return { nom: '', prenom: '' };
    }
    
    const cleanName = fullName.trim();
    const words = cleanName.split(/\s+/).filter(word => word.length > 0);
    
    if (words.length === 0) {
      return { nom: '', prenom: '' };
    } else if (words.length === 1) {
      return { nom: words[0], prenom: '' };
    } else {
      return { 
        nom: words[0], 
        prenom: words.slice(1).join(' ') 
      };
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setShowPreview(false);
      setShowVerification(false);
      setImportResult(null);
      setVerificationList([]);
    }
  };

  const previewData = async () => {
    if (!file) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier Excel.",
        variant: "destructive"
      });
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

      // Extraire les noms de la première colonne (ignorer les en-têtes vides)
      const names = jsonData
        .map(row => row[0])
        .filter(name => name && typeof name === 'string' && name.trim().length > 0);

      if (names.length === 0) {
        toast({
          title: "Fichier vide",
          description: "Aucun nom trouvé dans la première colonne du fichier.",
          variant: "destructive"
        });
        return;
      }

      const previewData = names.slice(0, 20).map(name => {
        const parsed = parseNameFromFullName(name);
        return {
          original: name,
          nom: parsed.nom,
          prenom: parsed.prenom
        };
      });

      setPreview(previewData);
      setShowPreview(true);
      setShowVerification(false);
      
      toast({
        title: "Aperçu généré",
        description: `${names.length} noms détectés dans le fichier. Aperçu des 20 premiers.`
      });
    } catch (error) {
      console.error('Erreur lors de la lecture du fichier:', error);
      toast({
        title: "Erreur de lecture",
        description: "Impossible de lire le fichier Excel. Vérifiez le format.",
        variant: "destructive"
      });
    }
  };

  // Nouvelle fonction de vérification des doublons
  const verifyDuplicates = async () => {
    if (!file) return;

    setIsVerifying(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

      const names = jsonData
        .map(row => row[0])
        .filter(name => name && typeof name === 'string' && name.trim().length > 0);

      // Récupérer tous les clients existants
      const { data: existingClients } = await supabase
        .from('clients')
        .select('nom, prenom');

      const verificationResults: ClientVerification[] = [];
      
      names.forEach(name => {
        const { nom, prenom } = parseNameFromFullName(name);
        
        if (!nom) return;

        const duplicateCheck = detectDuplicate(nom, prenom, existingClients || []);
        
        verificationResults.push({
          nom,
          prenom,
          original: name,
          status: duplicateCheck.status,
          reason: duplicateCheck.reason,
          selected: duplicateCheck.status === 'nouveau' // Sélectionner automatiquement les nouveaux noms
        });
      });

      setVerificationList(verificationResults);
      setShowVerification(true);
      setShowPreview(false);

      const newClients = verificationResults.filter(client => client.status === 'nouveau');
      const duplicates = verificationResults.filter(client => client.status !== 'nouveau');

      toast({
        title: "Vérification terminée",
        description: `${newClients.length} nouveaux clients détectés, ${duplicates.length} doublons trouvés.`
      });

    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      toast({
        title: "Erreur de vérification",
        description: "Une erreur est survenue lors de la vérification des doublons.",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Fonction pour basculer la sélection d'un client
  const toggleClientSelection = (index: number) => {
    setVerificationList(prev => 
      prev.map((client, i) => 
        i === index ? { ...client, selected: !client.selected } : client
      )
    );
  };

  // Fonction pour sélectionner/désélectionner tous les nouveaux clients
  const toggleAllNewClients = (selected: boolean) => {
    setVerificationList(prev => 
      prev.map(client => 
        client.status === 'nouveau' ? { ...client, selected } : client
      )
    );
  };

  const importClients = async () => {
    if (!file || verificationList.length === 0) return;

    const selectedClients = verificationList.filter(client => client.selected);
    
    if (selectedClients.length === 0) {
      toast({
        title: "Aucune sélection",
        description: "Veuillez sélectionner au moins un client à importer.",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setImportResult(null);

    try {
      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < selectedClients.length; i++) {
        const client = selectedClients[i];
        
        try {
          const { error } = await supabase
            .from('clients')
            .insert({
              nom: client.nom,
              prenom: client.prenom || null
            });

          if (error) {
            errors.push(`${client.original}: ${error.message}`);
          } else {
            successCount++;
          }
        } catch (error) {
          errors.push(`${client.original}: Erreur inconnue`);
        }

        setProgress(Math.round(((i + 1) / selectedClients.length) * 100));
      }

      const result = {
        success: successCount,
        duplicates: verificationList.length - selectedClients.length,
        errors
      };

      setImportResult(result);

      if (successCount > 0) {
        toast({
          title: "Import terminé",
          description: `${successCount} clients importés avec succès.`
        });
      }

      if (errors.length > 0) {
        toast({
          title: "Erreurs détectées",
          description: `${errors.length} erreurs lors de l'import.`,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      toast({
        title: "Erreur d'import",
        description: "Une erreur est survenue lors de l'import.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      setProgress(0);
    }
  };

  const getStatusBadge = (status: ClientVerification['status']) => {
    switch (status) {
      case 'nouveau':
        return <Badge variant="default" className="bg-green-100 text-green-800">Nouveau</Badge>;
      case 'doublon_exact':
        return <Badge variant="destructive">Doublon exact</Badge>;
      case 'doublon_probable':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Doublon probable</Badge>;
      default:
        return null;
    }
  };

  const newClientsCount = verificationList.filter(c => c.status === 'nouveau').length;
  const selectedCount = verificationList.filter(c => c.selected).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Import de clients depuis Excel
        </CardTitle>
        <CardDescription>
          Importez une liste de clients depuis un fichier Excel avec vérification des doublons. Seuls les nouveaux noms non présents en base seront affichés pour import.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sélection du fichier */}
        <div className="space-y-2">
          <Label htmlFor="excel-file">Fichier Excel</Label>
          <div className="flex items-center gap-4">
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="flex-1"
            />
            <Button 
              onClick={previewData}
              disabled={!file || isImporting || isVerifying}
              variant="outline"
            >
              <Eye className="h-4 w-4 mr-2" />
              Aperçu
            </Button>
          </div>
        </div>

        {/* Aperçu des données */}
        {showPreview && preview.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Aperçu des données (20 premiers):</h4>
              <Button 
                onClick={verifyDuplicates}
                disabled={isVerifying}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                {isVerifying ? 'Vérification...' : 'Vérifier les doublons'}
              </Button>
            </div>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left">Nom original</th>
                    <th className="p-2 text-left">Nom</th>
                    <th className="p-2 text-left">Prénom</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((client, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">{client.original}</td>
                      <td className="p-2 font-medium">{client.nom}</td>
                      <td className="p-2">{client.prenom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Liste de vérification */}
        {showVerification && verificationList.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Vérification des doublons ({selectedCount} sélectionnés)
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleAllNewClients(true)}
                >
                  Sélectionner tous les nouveaux
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleAllNewClients(false)}
                >
                  Désélectionner tout
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>{newClientsCount} nouveaux clients</span>
              </div>
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                <span>{verificationList.filter(c => c.status === 'doublon_probable').length} doublons probables</span>
              </div>
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{verificationList.filter(c => c.status === 'doublon_exact').length} doublons exacts</span>
              </div>
            </div>

            <div className="border rounded-lg max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-12">Sélection</th>
                    <th className="p-2 text-left">Nom original</th>
                    <th className="p-2 text-left">Nom</th>
                    <th className="p-2 text-left">Prénom</th>
                    <th className="p-2 text-left">Statut</th>
                    <th className="p-2 text-left">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {verificationList.map((client, index) => (
                    <tr key={index} className={`border-t ${client.status !== 'nouveau' ? 'bg-muted/30' : ''}`}>
                      <td className="p-2">
                        <Checkbox
                          checked={client.selected}
                          onCheckedChange={() => toggleClientSelection(index)}
                          disabled={client.status === 'doublon_exact'}
                        />
                      </td>
                      <td className="p-2">{client.original}</td>
                      <td className="p-2 font-medium">{client.nom}</td>
                      <td className="p-2">{client.prenom}</td>
                      <td className="p-2">{getStatusBadge(client.status)}</td>
                      <td className="p-2 text-xs text-muted-foreground">{client.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Barre de progression */}
        {isImporting && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Import en cours...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* Résultats de l'import */}
        {importResult && (
          <div className="space-y-3">
            <h4 className="font-medium">Résultats de l'import:</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>{importResult.success} clients ajoutés</span>
              </div>
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                <span>{importResult.duplicates} ignorés</span>
              </div>
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{importResult.errors.length} erreurs</span>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="border rounded-lg p-3 bg-destructive/5">
                <h5 className="font-medium text-destructive mb-2">Erreurs détectées:</h5>
                <div className="text-sm space-y-1 max-h-32 overflow-y-auto">
                  {importResult.errors.map((error, index) => (
                    <div key={index} className="text-destructive">• {error}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex gap-3">
          {showVerification && (
            <Button
              onClick={importClients}
              disabled={selectedCount === 0 || isImporting}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {isImporting ? 'Import en cours...' : `Importer ${selectedCount} clients`}
            </Button>
          )}
          
          {(showPreview || showVerification || importResult) && (
            <Button
              variant="outline"
              onClick={() => {
                setFile(null);
                setShowPreview(false);
                setShowVerification(false);
                setImportResult(null);
                setPreview([]);
                setVerificationList([]);
                const input = document.getElementById('excel-file') as HTMLInputElement;
                if (input) input.value = '';
              }}
            >
              Nouveau fichier
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};