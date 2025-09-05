import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
  id: string;
  type: "echeance_droit_terre" | "loyer_retard" | "facture_impayee";
  title: string;
  message: string;
  entity: string;
  priority: "high" | "medium" | "low";
  read: boolean;
  created_at: string;
  entity_id?: string;
}

export function useNotifications() {
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());

  // Fetch data for generating notifications
  const { data: echeancesData } = useQuery({
    queryKey: ["echeances-droit-terre"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("echeances_droit_terre")
        .select(`
          *,
          souscriptions(
            id,
            client_id,
            propriete_id
          )
        `)
        .eq("statut", "en_attente")
        .lte("date_echeance", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients-basic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, nom, prenom");
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: proprietesData } = useQuery({
    queryKey: ["proprietes-basic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proprietes")
        .select("id, nom");
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: locationsData } = useQuery({
    queryKey: ["locations-retard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select(`
          *,
          clients(nom, prenom),
          proprietes(nom),
          paiements_locations(date_paiement, montant)
        `)
        .eq("statut", "active")
        .gt("dette_totale", 0);
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: facturesData } = useQuery({
    queryKey: ["factures-impayees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factures_fournisseurs")
        .select(`
          *,
          fournisseurs(nom),
          proprietes(nom)
        `)
        .gt("solde", 0);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Generate notifications
  const notifications = useMemo(() => {
    const notifs: Notification[] = [];

    // Échéances de droit de terre
    echeancesData?.forEach((echeance) => {
      const souscription = echeance.souscriptions as any;
      const client = clientsData?.find(c => c.id === souscription?.client_id);
      const propriete = proprietesData?.find(p => p.id === souscription?.propriete_id);
      
      const daysUntilDue = Math.ceil((new Date(echeance.date_echeance).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      let priority: "high" | "medium" | "low" = "low";
      
      if (daysUntilDue <= 7) priority = "high";
      else if (daysUntilDue <= 15) priority = "medium";

      notifs.push({
        id: `echeance-${echeance.id}`,
        type: "echeance_droit_terre",
        title: "Échéance droit de terre",
        message: `Échéance #${echeance.numero_echeance} due dans ${daysUntilDue} jours (${echeance.montant.toLocaleString()} FCFA)`,
        entity: `${client?.prenom || ''} ${client?.nom || ''} - ${propriete?.nom || ''}`,
        priority,
        read: readNotifications.has(`echeance-${echeance.id}`),
        created_at: new Date().toISOString(),
        entity_id: echeance.souscription_id
      });
    });

    // Loyers en retard
    locationsData?.forEach((location) => {
      const lastPayment = location.paiements_locations
        ?.sort((a: any, b: any) => new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime())[0];
      
      if (location.dette_totale > 0) {
        notifs.push({
          id: `loyer-${location.id}`,
          type: "loyer_retard",
          title: "Loyer en retard",
          message: `Dette de ${location.dette_totale.toLocaleString()} FCFA`,
          entity: `${location.clients.prenom} ${location.clients.nom} - ${location.proprietes.nom}`,
          priority: location.dette_totale > location.loyer_mensuel * 2 ? "high" : "medium",
          read: readNotifications.has(`loyer-${location.id}`),
          created_at: new Date().toISOString(),
          entity_id: location.id
        });
      }
    });

    // Factures impayées
    facturesData?.forEach((facture) => {
      const daysOverdue = Math.ceil((new Date().getTime() - new Date(facture.date_facture).getTime()) / (1000 * 60 * 60 * 24));
      
      notifs.push({
        id: `facture-${facture.id}`,
        type: "facture_impayee",
        title: "Facture impayée",
        message: `Facture ${facture.numero} - ${facture.solde.toLocaleString()} FCFA (${daysOverdue} jours)`,
        entity: `${facture.fournisseurs.nom}${facture.proprietes ? ` - ${facture.proprietes.nom}` : ''}`,
        priority: daysOverdue > 30 ? "high" : daysOverdue > 15 ? "medium" : "low",
        read: readNotifications.has(`facture-${facture.id}`),
        created_at: new Date().toISOString(),
        entity_id: facture.id
      });
    });

    return notifs.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (a.priority !== b.priority) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [echeancesData, locationsData, facturesData, readNotifications, clientsData, proprietesData]);

  const markAsRead = (notificationId: string) => {
    setReadNotifications(prev => new Set([...prev, notificationId]));
  };

  const clearAll = () => {
    const allIds = notifications.map(n => n.id);
    setReadNotifications(new Set(allIds));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAsRead,
    clearAll
  };
}