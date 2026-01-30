import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";

export function useCompanyLogo() {
  return useQuery({
    queryKey: ["company-logo"],
    queryFn: async () => {
      try {
        const data = await apiClient.select({
          table: "company_settings",
          limit: 1
        });

        return data?.[0]?.logo_url || null;
      } catch (error) {
        console.error("Error fetching company logo:", error);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
