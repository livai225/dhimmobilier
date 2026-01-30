// API Client complet pour le backend MySQL
// Remplace les appels Supabase par des appels REST

export interface ApiClientOptions {
  baseUrl?: string;
  authCookieName?: string;
}

export interface DbSelectOptions {
  table: string;
  filters?: Array<{ op: string; column: string; value?: any; values?: any[] }>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  single?: boolean;
}

export interface DbInsertOptions {
  table: string;
  values: Record<string, any> | Array<Record<string, any>>;
}

export interface DbUpdateOptions {
  table: string;
  filters: Array<{ op: string; column: string; value?: any }>;
  values: Record<string, any>;
}

export interface DbDeleteOptions {
  table: string;
  filters: Array<{ op: string; column: string; value?: any }>;
}

const defaultBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.origin}/api`;

export class ApiClient {
  baseUrl: string;
  authCookieName: string;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl || defaultBaseUrl;
    this.authCookieName =
      options.authCookieName ||
      import.meta.env.VITE_API_AUTH_COOKIE_NAME ||
      "dhimmobilier_session";
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      ...init,
    });

    if (!res.ok) {
      let errorMessage = res.statusText;
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorData.message || res.statusText;
      } catch {
        // Si ce n'est pas du JSON, utiliser le texte brut
        const text = await res.text();
        errorMessage = text || res.statusText;
      }
      throw new Error(errorMessage);
    }

    // Handle empty responses
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return (await res.json()) as T;
    }
    return undefined as T;
  }

  // ============== AUTH ==============
  login(data: { username: string; password: string }) {
    return this.request<{ user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  currentUser() {
    return this.request<{ user: any }>("/auth/me");
  }

  logout() {
    return this.request<{ success: boolean }>("/auth/logout", { method: "POST" });
  }

  getUserPermissions(userId: string) {
    return this.request<Array<{ permission_name: string; granted: boolean }>>(
      `/users/${userId}/permissions`
    );
  }

  // ============== GENERIC DB OPERATIONS ==============
  select<T = any>(options: DbSelectOptions): Promise<T> {
    return this.request<T>("/db/select", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  insert(options: DbInsertOptions): Promise<{ count: number }> {
    return this.request<{ count: number }>("/db/insert", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  update(options: DbUpdateOptions): Promise<{ count: number }> {
    return this.request<{ count: number }>("/db/update", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  delete(options: DbDeleteOptions): Promise<{ count: number }> {
    return this.request<{ count: number }>("/db/delete", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  upsert(options: DbInsertOptions): Promise<any> {
    return this.request<any>("/db/upsert", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  // ============== RPC CALLS ==============
  rpc<T = any>(fn: string, params: Record<string, any> = {}): Promise<T> {
    return this.request<T>(`/rpc/${fn}`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // ============== CASH / CAISSE ==============
  getCashBalanceVersement() {
    return this.request<number>("/cash/balance/versement");
  }

  getCashBalanceEntreprise() {
    return this.request<number>("/cash/balance/entreprise");
  }

  getSoldeCaisseEntreprise() {
    return this.rpc<number>("get_solde_caisse_entreprise");
  }

  getCurrentCashBalance() {
    return this.rpc<number>("get_current_cash_balance");
  }

  recordCashTransaction(data: {
    montant: number;
    type_transaction: "entree" | "sortie";
    type_operation: string;
    agent_id?: string;
    beneficiaire?: string;
    description?: string;
    reference?: string;
  }) {
    return this.rpc<string>("record_cash_transaction", data);
  }

  // ============== PAYMENTS ==============
  payLocationWithCash(data: {
    location_id: string;
    montant: number;
    client_id?: string;
    mode_paiement?: string;
    reference?: string;
    mois_concerne?: string;
  }) {
    return this.rpc<string>("pay_location_with_cash", data);
  }

  paySouscriptionWithCash(data: {
    souscription_id: string;
    montant: number;
    client_id?: string;
    mode_paiement?: string;
    reference?: string;
  }) {
    return this.rpc<string>("pay_souscription_with_cash", data);
  }

  payDroitTerreWithCash(data: {
    souscription_id: string;
    montant: number;
    client_id?: string;
    mode_paiement?: string;
    reference?: string;
  }) {
    return this.rpc<string>("pay_droit_terre_with_cash", data);
  }

  payFactureWithCash(data: {
    facture_id: string;
    montant: number;
    mode_paiement?: string;
    reference?: string;
  }) {
    return this.rpc<string>("pay_facture_with_cash", data);
  }

  payCautionWithCash(data: {
    location_id: string;
    montant: number;
    mode_paiement?: string;
    reference?: string;
  }) {
    return this.rpc<string>("pay_caution_with_cash", data);
  }

  // ============== STATISTICS ==============
  getStats() {
    return this.rpc<{
      clients: number;
      proprietes: number;
      locations_actives: number;
      souscriptions_actives: number;
      solde_caisse: number;
    }>("getStats");
  }

  getDashboardStats() {
    return this.rpc<{
      clients_total: number;
      locations_actives: number;
      souscriptions_actives: number;
      solde_caisse: number;
      entrees_mois: number;
      sorties_mois: number;
      impayes_locations: number;
    }>("get_dashboard_stats");
  }

  getAgentStatistics(data: { agent_id: string; start_date?: string; end_date?: string }) {
    return this.rpc<Array<{
      total_verse: number;
      nombre_versements: number;
      moyenne_versement: number;
      dernier_versement: string | null;
    }>>("get_agent_statistics", data);
  }

  // ============== UTILITIES ==============
  generateFactureNumber() {
    return this.rpc<string>("generate_facture_number");
  }

  deleteLocationSafely(locationId: string) {
    return this.rpc<boolean>("delete_location_safely", { location_id: locationId });
  }

  calculateSoldeDroitTerre(souscriptionId: string) {
    return this.rpc<number>("calculate_solde_droit_terre", { souscription_id: souscriptionId });
  }

  // ============== CRUD HELPERS ==============
  // Clients
  getClients(filters?: Array<{ op: string; column: string; value?: any }>) {
    return this.select({ table: "clients", filters, orderBy: { column: "created_at", ascending: false } });
  }

  getClient(id: string) {
    return this.select({ table: "clients", filters: [{ op: "eq", column: "id", value: id }], single: true });
  }

  createClient(data: Record<string, any>) {
    return this.insert({ table: "clients", values: data });
  }

  updateClient(id: string, data: Record<string, any>) {
    return this.update({ table: "clients", filters: [{ op: "eq", column: "id", value: id }], values: data });
  }

  deleteClient(id: string) {
    return this.delete({ table: "clients", filters: [{ op: "eq", column: "id", value: id }] });
  }

  // Propriétés
  getProprietes(filters?: Array<{ op: string; column: string; value?: any }>) {
    return this.select({ table: "proprietes", filters, orderBy: { column: "created_at", ascending: false } });
  }

  createPropriete(data: Record<string, any>) {
    return this.insert({ table: "proprietes", values: data });
  }

  updatePropriete(id: string, data: Record<string, any>) {
    return this.update({ table: "proprietes", filters: [{ op: "eq", column: "id", value: id }], values: data });
  }

  deletePropriete(id: string) {
    return this.delete({ table: "proprietes", filters: [{ op: "eq", column: "id", value: id }] });
  }

  // Locations
  getLocations(filters?: Array<{ op: string; column: string; value?: any }>) {
    return this.select({ table: "locations", filters, orderBy: { column: "created_at", ascending: false } });
  }

  createLocation(data: Record<string, any>) {
    return this.insert({ table: "locations", values: data });
  }

  updateLocation(id: string, data: Record<string, any>) {
    return this.update({ table: "locations", filters: [{ op: "eq", column: "id", value: id }], values: data });
  }

  // Souscriptions
  getSouscriptions(filters?: Array<{ op: string; column: string; value?: any }>) {
    return this.select({ table: "souscriptions", filters, orderBy: { column: "created_at", ascending: false } });
  }

  createSouscription(data: Record<string, any>) {
    return this.insert({ table: "souscriptions", values: data });
  }

  updateSouscription(id: string, data: Record<string, any>) {
    return this.update({ table: "souscriptions", filters: [{ op: "eq", column: "id", value: id }], values: data });
  }

  // Fournisseurs
  getFournisseurs() {
    return this.select({ table: "fournisseurs", orderBy: { column: "nom", ascending: true } });
  }

  createFournisseur(data: Record<string, any>) {
    return this.insert({ table: "fournisseurs", values: data });
  }

  updateFournisseur(id: string, data: Record<string, any>) {
    return this.update({ table: "fournisseurs", filters: [{ op: "eq", column: "id", value: id }], values: data });
  }

  deleteFournisseur(id: string) {
    return this.delete({ table: "fournisseurs", filters: [{ op: "eq", column: "id", value: id }] });
  }

  // Factures
  getFactures(filters?: Array<{ op: string; column: string; value?: any }>) {
    return this.select({ table: "factures_fournisseurs", filters, orderBy: { column: "date_facture", ascending: false } });
  }

  createFacture(data: Record<string, any>) {
    return this.insert({ table: "factures_fournisseurs", values: data });
  }

  updateFacture(id: string, data: Record<string, any>) {
    return this.update({ table: "factures_fournisseurs", filters: [{ op: "eq", column: "id", value: id }], values: data });
  }

  // Agents
  getAgents() {
    return this.select({ table: "agents_recouvrement", orderBy: { column: "nom", ascending: true } });
  }

  createAgent(data: Record<string, any>) {
    return this.insert({ table: "agents_recouvrement", values: data });
  }

  updateAgent(id: string, data: Record<string, any>) {
    return this.update({ table: "agents_recouvrement", filters: [{ op: "eq", column: "id", value: id }], values: data });
  }

  deleteAgent(id: string) {
    return this.delete({ table: "agents_recouvrement", filters: [{ op: "eq", column: "id", value: id }] });
  }

  // Transactions
  getCashTransactions(filters?: Array<{ op: string; column: string; value?: any }>, limit?: number) {
    return this.select({
      table: "cash_transactions",
      filters,
      orderBy: { column: "date_transaction", ascending: false },
      limit
    });
  }

  // Recus
  getRecus(filters?: Array<{ op: string; column: string; value?: any }>) {
    return this.select({ table: "recus", filters, orderBy: { column: "date_generation", ascending: false } });
  }

  // Users
  getUsers() {
    return this.select({ table: "users", orderBy: { column: "nom", ascending: true } });
  }

  updateUser(id: string, data: Record<string, any>) {
    return this.update({ table: "users", filters: [{ op: "eq", column: "id", value: id }], values: data });
  }

  // Types propriétés
  getTypesProprietes() {
    return this.select({ table: "types_proprietes", orderBy: { column: "nom", ascending: true } });
  }

  // Barème droits terre
  getBaremeDroitsTerre() {
    return this.select({ table: "bareme_droits_terre", orderBy: { column: "type_bien", ascending: true } });
  }
}

export const apiClient = new ApiClient();
