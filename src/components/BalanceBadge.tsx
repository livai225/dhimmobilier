import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function BalanceBadge() {
  const { data: balanceVersement = 0, isLoading: isLoadingVersement } = useQuery({
    queryKey: ["cash_balance"],
    queryFn: async () => {
      return Number(await apiClient.getCurrentCashBalance());
    },
  });

  const { data: balanceEntreprise = 0, isLoading: isLoadingEntreprise } = useQuery({
    queryKey: ["entreprise_balance"],
    queryFn: async () => {
      return Number(await apiClient.getSoldeCaisseEntreprise());
    },
  });

  if (isLoadingVersement || isLoadingEntreprise) {
    return <Skeleton className="h-6 w-48" />;
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="text-xs">
        Caisse Versement: {balanceVersement.toLocaleString()} FCFA
      </Badge>
      <Badge variant="outline" className="text-xs">
        Caisse Entreprise: {balanceEntreprise.toLocaleString()} FCFA
      </Badge>
    </div>
  );
}

export default BalanceBadge;
