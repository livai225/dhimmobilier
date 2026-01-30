import { io, Socket } from "socket.io-client";
import type { QueryClient } from "@tanstack/react-query";

const tableQueryMap: Record<string, string[][]> = {
  clients: [["clients"], ["dashboard-stats"]],
  proprietes: [["properties"], ["proprietes"], ["dashboard-stats"]],
  locations: [["locations"], ["dashboard-stats"]],
  souscriptions: [["souscriptions"], ["dashboard-stats"]],
  paiements_locations: [["receipts"], ["paiements"], ["dashboard-stats"], ["locations"]],
  paiements_souscriptions: [["receipts"], ["paiements"], ["dashboard-stats"], ["souscriptions"]],
  paiements_cautions: [["receipts"], ["paiements"], ["dashboard-stats"]],
  paiements_droit_terre: [["receipts"], ["paiements"], ["dashboard-stats"]],
  paiements_factures: [["receipts"], ["paiements"], ["dashboard-stats"], ["factures"]],
  versements_agents: [["receipts"], ["dashboard-stats"], ["agents"]],
  factures_fournisseurs: [["factures"], ["dashboard-stats"]],
  fournisseurs: [["fournisseurs"]],
  agents_recouvrement: [["agents"], ["dashboard-stats"]],
  cash_transactions: [["cash_balance"], ["entreprise_balance"], ["dashboard-stats"], ["transactions"]],
  caisse_balance: [["entreprise_balance"], ["cash_balance"], ["dashboard-stats"]],
  recus: [["recus"], ["receipts"]],
  users: [["users"]],
  user_permissions: [["users"], ["permissions"]],
  articles: [["articles"], ["ventes"]],
  ventes: [["ventes"], ["dashboard-stats"]],
  types_proprietes: [["types_proprietes"], ["proprietes"]],
  audit_logs: [["audit_logs"]],
  bareme_droits_terre: [["bareme_droits_terre"]],
};

let socket: Socket | null = null;

export function initRealtime(queryClient: QueryClient) {
  if (socket) return socket;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  // Socket.IO se connecte à l'origin mais utilise le path de l'API
  // Ex: si API = /dhimmobilier-api, alors path = /dhimmobilier-api/socket.io/
  socket = io(window.location.origin, {
    path: `${apiBaseUrl}/socket.io/`,
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.info("[realtime] connected");
  });

  socket.on("db-change", (payload: { table: string; action: string }) => {
    const keys = tableQueryMap[payload.table] || [["dashboard-stats"]];
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  });

  socket.on("disconnect", (reason) => {
    console.warn("[realtime] disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("[realtime] connection error:", error.message);
  });

  socket.on("reconnect", (attemptNumber) => {
    console.info("[realtime] reconnected after", attemptNumber, "attempts");
  });

  socket.on("reconnect_failed", () => {
    console.error("[realtime] reconnection failed after max attempts");
  });

  return socket;
}
