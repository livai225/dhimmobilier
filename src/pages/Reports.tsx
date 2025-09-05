import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Download, 
  TrendingUp, 
  BarChart3, 
  Calculator,
  Calendar
} from "lucide-react";
import { FinancialReports } from "@/components/reports/FinancialReports";
import { ComparativeReports } from "@/components/reports/ComparativeReports";
import { ProfitabilityAnalysis } from "@/components/reports/ProfitabilityAnalysis";
import { AccountingReports } from "@/components/reports/AccountingReports";

export default function Reports() {
  const [activeTab, setActiveTab] = useState("financial");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Rapports & Analytics</h1>
          <p className="text-muted-foreground">
            Analyses détaillées et rapports financiers
          </p>
        </div>
        <Button className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Exporter tout
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Centre de rapports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
              <TabsTrigger value="financial" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Financiers
              </TabsTrigger>
              <TabsTrigger value="comparative" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Comparatifs
              </TabsTrigger>
              <TabsTrigger value="profitability" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Rentabilité
              </TabsTrigger>
              <TabsTrigger value="accounting" className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Comptables
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="financial">
                <FinancialReports />
              </TabsContent>
              
              <TabsContent value="comparative">
                <ComparativeReports />
              </TabsContent>
              
              <TabsContent value="profitability">
                <ProfitabilityAnalysis />
              </TabsContent>
              
              <TabsContent value="accounting">
                <AccountingReports />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}