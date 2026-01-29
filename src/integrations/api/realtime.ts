import { io, Socket } from "socket.io-client";
import type { QueryClient } from "@tanstack/react-query";

const tableQueryMap: Record<string, string[][]> = {
  clients: [["clients"]],
  proprietes: [["properties"], ["dashboard-stats"]],
  locations: [["locations"], ["dashboard-stats"]],
  souscriptions: [["souscriptions"], ["dashboard-stats"]],
  paiements_locations: [["receipts"], ["dashboard-stats"]],
  paiements_souscriptions: [["receipts"], ["dashboard-stats"]],
  paiements_cautions: [["receipts"], ["dashboard-stats"]],
  paiements_droit_terre: [["receipts"], ["dashboard-stats"]],
  paiements_factures: [["receipts"], ["dashboard-stats"]],
  versements_agents: [["receipts"], ["dashboard-stats"]],
  factures_fournisseurs: [["factures"]],
  fournisseurs: [["fournisseurs"]],
  agents_recouvrement: [["agents"]],
  cash_transactions: [["cash_balance"], ["entreprise_balance"], ["dashboard-stats"]],
  caisse_balance: [["entreprise_balance"]],
  recus: [["recus"]],
  users: [["users"]],
  user_permissions: [["users"]],
};

let socket: Socket | null = null;

export function initRealtime(queryClient: QueryClient) {
  if (socket) return socket;
  const baseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    `${window.location.origin.replace(/\/$/, "")}`;
  socket = io(baseUrl, { withCredentials: true });

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

  return socket;
}
