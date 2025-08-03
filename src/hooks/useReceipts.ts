import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReceiptWithDetails {
  id: string;
  numero: string;
  date_generation: string;
  client_id: string;
  reference_id: string;
  type_operation: string;
  montant_total: number;
  periode_debut: string | null;
  periode_fin: string | null;
  client: {
    nom: string;
    prenom: string | null;
    email: string | null;
    telephone_principal: string | null;
  } | null;
}

export const useReceipts = (filters?: {
  type_operation?: string;
  client_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: ["recus", filters],
    queryFn: async () => {
      let query = supabase
        .from("recus")
        .select(`
          *,
          client:clients(nom, prenom, email, telephone_principal)
        `)
        .order("date_generation", { ascending: false });

      if (filters?.type_operation && filters.type_operation !== "all") {
        query = query.eq("type_operation", filters.type_operation);
      }

      if (filters?.client_id && filters.client_id !== "all") {
        query = query.eq("client_id", filters.client_id);
      }

      if (filters?.date_from) {
        query = query.gte("date_generation", filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte("date_generation", filters.date_to);
      }

      if (filters?.search) {
        query = query.ilike("numero", `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ReceiptWithDetails[];
    },
  });
};

export const useReceiptStats = () => {
  return useQuery({
    queryKey: ["receipt-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recus")
        .select("type_operation, montant_total, date_generation");

      if (error) throw error;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const thisMonth = data.filter(r => {
        const date = new Date(r.date_generation);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });

      const stats = {
        totalReceipts: data.length,
        totalThisMonth: thisMonth.reduce((sum, r) => sum + Number(r.montant_total), 0),
        receiptsByType: data.reduce((acc, r) => {
          acc[r.type_operation] = (acc[r.type_operation] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        lastReceipt: data.sort((a, b) => 
          new Date(b.date_generation).getTime() - new Date(a.date_generation).getTime()
        )[0]
      };

      return stats;
    },
  });
};