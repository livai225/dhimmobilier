// Minimal API client placeholder for future MySQL backend.
// Replace Supabase calls by using this wrapper (fetch/axios can be swapped in).

export interface ApiClientOptions {
  baseUrl?: string;
  authCookieName?: string;
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

  async request<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      ...init,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }

    return (await res.json()) as T;
  }

  // --- Auth ---
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
    return this.request<void>("/auth/logout", { method: "POST" });
  }

  getUserPermissions(userId: string) {
    return this.request<Array<{ permission_name: string; granted: boolean }>>(
      `/users/${userId}/permissions`
    );
  }

  // --- Cash / caisse ---
  getCashBalanceVersement() {
    return this.request<number>("/cash/balance/versement");
  }

  getCashBalanceEntreprise() {
    return this.request<number>("/cash/balance/entreprise");
  }

  // TODO: implémenter le reste des endpoints (paiements, CRUD, stats, reçus).
}

export const apiClient = new ApiClient();
