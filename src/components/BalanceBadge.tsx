import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function BalanceBadge() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchBalance = async () => {
      try {
        const { data, error } = await supabase.rpc("get_current_cash_balance");
        if (error) throw error;
        if (mounted) setBalance(Number(data || 0));
      } catch (e) {
        if (mounted) setBalance(0);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchBalance();

    // Realtime updates could be added later by listening to cash_transactions
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <Skeleton className="h-6 w-28" />;
  }

  return (
    <Badge variant="secondary" className="text-xs">
      Solde caisse: {balance?.toLocaleString()} FCFA
    </Badge>
  );
}

export default BalanceBadge;
