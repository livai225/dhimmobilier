import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiClient } from "@/integrations/api/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function BalanceBadge() {
  const queryClient = useQueryClient();
  const useApi = import.meta.env.VITE_USE_API === 'true';

  const { data: balanceVersement = 0, isLoading: isLoadingVersement } = useQuery({
    queryKey: ["cash_balance"],
    queryFn: async () => {
      if (useApi) {
        return Number(await apiClient.getCashBalanceVersement());
      }
      const { data, error } = await supabase.rpc("get_current_cash_balance");
      if (error) throw error;
      return Number(data || 0);
    },
  });

  const { data: balanceEntreprise = 0, isLoading: isLoadingEntreprise } = useQuery({
    queryKey: ["entreprise_balance"],
    queryFn: async () => {
      if (useApi) {
        return Number(await apiClient.getCashBalanceEntreprise());
      }
      const { data, error } = await supabase.rpc("get_solde_caisse_entreprise");
      if (error) throw error;
      return Number(data || 0);
    },
  });

  // Real-time updates for cash transactions
  useEffect(() => {
    if (useApi) {
      // TODO: branch Socket.io listener; fallback: manual refetch via invalidations after mutations
      return;
    }
    const channel = supabase
      .channel('cash_transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cash_transactions'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["cash_balance"] });
          queryClient.invalidateQueries({ queryKey: ["entreprise_balance"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, useApi]);

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
