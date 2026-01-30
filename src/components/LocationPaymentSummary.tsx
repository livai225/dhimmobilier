import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, DollarSign, Target, Percent, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface PaymentSummaryProps {
  locations: any[];
}

export function LocationPaymentSummary({ locations }: PaymentSummaryProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Generate month options (current year + previous year)
  const monthOptions = useMemo(() => {
    const options = [{ value: "all", label: "Tous les mois" }];
    const currentYear = new Date().getFullYear();
    const months = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];

    // Add current year months
    for (let i = 0; i < 12; i++) {
      options.push({
        value: `${currentYear}-${i + 1}`,
        label: `${months[i]} ${currentYear}`
      });
    }

    // Add previous year months
    for (let i = 0; i < 12; i++) {
      options.push({
        value: `${currentYear - 1}-${i + 1}`,
        label: `${months[i]} ${currentYear - 1}`
      });
    }

    return options;
  }, []);

  const { data: payments = [] } = useQuery({
    queryKey: ["location_payments_summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_locations")
        .select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const paymentSummary = useMemo(() => {
    // Filter payments by selected month
    let filteredPayments = payments;
    if (selectedMonth !== "all") {
      const [year, month] = selectedMonth.split("-");
      filteredPayments = payments.filter(payment => {
        const paymentDate = new Date(payment.date_paiement);
        return paymentDate.getFullYear() === parseInt(year) && 
               paymentDate.getMonth() + 1 === parseInt(month);
      });
    }

    // Calculate total paid for the period
    const totalPaid = filteredPayments.reduce((sum, payment) => 
      sum + Number(payment.montant), 0);

    // Calculate total due for the period
    let totalDue = 0;
    
    if (selectedMonth === "all") {
      // For all months, calculate based on current debt
      totalDue = locations.reduce((sum, location) => {
        if (!location.date_debut || !location.loyer_mensuel) return sum;
        
        const startDate = new Date(location.date_debut);
        const currentDate = new Date();
        const yearsElapsed = currentDate.getFullYear() - startDate.getFullYear();
        const monthsInCurrentYear = currentDate.getMonth() - startDate.getMonth();
        
        let locationDue = 0;
        if (location.type_contrat === 'historique') {
          const totalMonthsElapsed = yearsElapsed * 12 + monthsInCurrentYear;
          locationDue = Math.max(0, totalMonthsElapsed * location.loyer_mensuel);
        } else {
          if (yearsElapsed === 0) {
            locationDue = location.loyer_mensuel * 10;
          } else {
            locationDue = (location.loyer_mensuel * 10) + 
                         ((yearsElapsed - 1) * location.loyer_mensuel * 12) + 
                         (monthsInCurrentYear * location.loyer_mensuel);
          }
        }
        
        return sum + locationDue;
      }, 0);
    } else {
      // For specific month, calculate what was due that month
      const [year, month] = selectedMonth.split("-");
      const targetDate = new Date(parseInt(year), parseInt(month) - 1);
      
      totalDue = locations.reduce((sum, location) => {
        if (!location.date_debut || !location.loyer_mensuel) return sum;
        
        const startDate = new Date(location.date_debut);
        
        // Only include locations that were active during the target month
        if (startDate > targetDate) return sum;
        
        return sum + location.loyer_mensuel;
      }, 0);
    }

    const recoveryRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;
    const outstanding = Math.max(0, totalDue - totalPaid);

    return {
      totalDue,
      totalPaid,
      recoveryRate,
      outstanding
    };
  }, [locations, payments, selectedMonth]);

  const getStatusColor = (rate: number) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-4">
      {/* Month Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Synthèse des paiements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Target className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <div className="text-lg font-bold text-blue-600">
                {formatCurrency(paymentSummary.totalDue)}
              </div>
              <p className="text-xs text-muted-foreground">À percevoir</p>
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <DollarSign className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(paymentSummary.totalPaid)}
              </div>
              <p className="text-xs text-muted-foreground">Payé</p>
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Percent className={`w-6 h-6 mx-auto mb-2 ${getStatusColor(paymentSummary.recoveryRate)}`} />
              <div className={`text-lg font-bold ${getStatusColor(paymentSummary.recoveryRate)}`}>
                {paymentSummary.recoveryRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Taux recouvrement</p>
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-red-600" />
              <div className="text-lg font-bold text-red-600">
                {formatCurrency(paymentSummary.outstanding)}
              </div>
              <p className="text-xs text-muted-foreground">En retard</p>
            </div>
          </div>

          {/* Recovery Rate Bar */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Progression du recouvrement</span>
              <span className={`text-sm font-bold ${getStatusColor(paymentSummary.recoveryRate)}`}>
                {paymentSummary.recoveryRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  paymentSummary.recoveryRate >= 90 ? 'bg-green-500' :
                  paymentSummary.recoveryRate >= 70 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(paymentSummary.recoveryRate, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}