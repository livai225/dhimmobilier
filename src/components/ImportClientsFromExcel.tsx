import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface ClientPreview {
  nom: string;
  prenom: string;
  original: string;
}

interface ImportResult {
  success: number;
  errors: string[];
  duplicates: number;
}

export const ImportClientsFromExcel = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<ClientPreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

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
      setImportResult(null);
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

  const importClients = async () => {
    if (!file) return;

    setIsImporting(true);
    setProgress(0);
    setImportResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

      const names = jsonData
        .map(row => row[0])
        .filter(name => name && typeof name === 'string' && name.trim().length > 0);

      if (names.length === 0) {
        toast({
          title: "Fichier vide",
          description: "Aucun nom trouvé dans le fichier.",
          variant: "destructive"
        });
        return;
      }

      // Vérifier les doublons existants
      const { data: existingClients } = await supabase
        .from('clients')
        .select('nom, prenom');

      const existingSet = new Set(
        existingClients?.map(client => `${client.nom}_${client.prenom}`) || []
      );

      let successCount = 0;
      let duplicateCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < names.length; i++) {
        const fullName = names[i];
        const { nom, prenom } = parseNameFromFullName(fullName);
        
        if (!nom) {
          errors.push(`Ligne ${i + 1}: Nom vide - "${fullName}"`);
          continue;
        }

        const clientKey = `${nom}_${prenom}`;
        if (existingSet.has(clientKey)) {
          duplicateCount++;
          continue;
        }

        try {
          const { error } = await supabase
            .from('clients')
            .insert({
              nom,
              prenom: prenom || null
            });

          if (error) {
            errors.push(`Ligne ${i + 1}: ${error.message} - "${fullName}"`);
          } else {
            successCount++;
            existingSet.add(clientKey);
          }
        } catch (error) {
          errors.push(`Ligne ${i + 1}: Erreur inconnue - "${fullName}"`);
        }

        setProgress(Math.round(((i + 1) / names.length) * 100));
      }

      const result = {
        success: successCount,
        duplicates: duplicateCount,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Import de clients depuis Excel
        </CardTitle>
        <CardDescription>
          Importez une liste de clients depuis un fichier Excel. Le fichier doit contenir une colonne avec les noms complets.
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
              disabled={!file || isImporting}
              variant="outline"
            >
              Aperçu
            </Button>
          </div>
        </div>

        {/* Aperçu des données */}
        {showPreview && preview.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Aperçu des données (20 premiers):</h4>
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
                <span>{importResult.duplicates} doublons ignorés</span>
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
          <Button
            onClick={importClients}
            disabled={!file || isImporting || !showPreview}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {isImporting ? 'Import en cours...' : 'Importer les clients'}
          </Button>
          
          {(showPreview || importResult) && (
            <Button
              variant="outline"
              onClick={() => {
                setFile(null);
                setShowPreview(false);
                setImportResult(null);
                setPreview([]);
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