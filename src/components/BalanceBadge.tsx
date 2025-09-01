import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function BalanceBadge() {
  const queryClient = useQueryClient();

  const { data: balance = 0, isLoading } = useQuery({
    queryKey: ["cash_balance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_current_cash_balance");
      if (error) throw error;
      return Number(data || 0);
    },
  });

  // Real-time updates for cash transactions
  useEffect(() => {
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (isLoading) {
    return <Skeleton className="h-6 w-28" />;
  }

  return (
    <Badge variant="secondary" className="text-xs">
      Solde caisse: {balance.toLocaleString()} FCFA
    </Badge>
  );
}

export default BalanceBadge;
