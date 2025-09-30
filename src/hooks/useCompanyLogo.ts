import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCompanyLogo() {
  return useQuery({
    queryKey: ["company-logo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("logo_url")
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching company logo:", error);
        return null;
      }
      
      return data?.logo_url || null;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
