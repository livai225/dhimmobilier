import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function BalanceBadge() {
  const [stableBalanceVersement, setStableBalanceVersement] = useState(0);
  const [stableBalanceEntreprise, setStableBalanceEntreprise] = useState(0);

  const { data: balanceVersementRaw, isLoading: isLoadingVersement } = useQuery({
    queryKey: ["cash_balance"],
    queryFn: async () => {
      const value = Number(await apiClient.getCurrentCashBalance());
      if (!Number.isFinite(value)) {
        throw new Error("Solde versement invalide");
      }
      return value;
    },
  });

  const { data: balanceEntrepriseRaw, isLoading: isLoadingEntreprise } = useQuery({
    queryKey: ["entreprise_balance"],
    queryFn: async () => {
      const value = Number(await apiClient.getSoldeCaisseEntreprise());
      if (!Number.isFinite(value)) {
        throw new Error("Solde entreprise invalide");
      }
      return value;
    },
  });

  useEffect(() => {
    if (Number.isFinite(balanceVersementRaw)) {
      setStableBalanceVersement(Number(balanceVersementRaw));
    }
  }, [balanceVersementRaw]);

  useEffect(() => {
    if (Number.isFinite(balanceEntrepriseRaw)) {
      setStableBalanceEntreprise(Number(balanceEntrepriseRaw));
    }
  }, [balanceEntrepriseRaw]);

  if (isLoadingVersement || isLoadingEntreprise) {
    return <Skeleton className="h-6 w-48" />;
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      <Badge 
        variant="secondary" 
        className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 transition-colors font-semibold"
      >
        Caisse Versement: <span className="font-bold ml-1">{stableBalanceVersement.toLocaleString()} FCFA</span>
      </Badge>
      <Badge 
        variant="outline" 
        className="text-xs bg-green-100 text-green-700 border-green-200 hover:bg-green-200 transition-colors font-semibold"
      >
        Caisse Entreprise: <span className="font-bold ml-1">{stableBalanceEntreprise.toLocaleString()} FCFA</span>
      </Badge>
    </div>
  );
}

export default BalanceBadge;
