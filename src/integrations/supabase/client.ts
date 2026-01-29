// Supabase shim replaced by API client for MySQL backend.
// This keeps the existing call sites (`supabase.from(...).select()`, `.rpc()`, etc.)
// but routes everything to the backend REST API defined in MIGRATION_MYSQL.md.

import { apiClient } from "@/integrations/api/client";

type Filter =
  | { op: "eq" | "ilike" | "gte" | "lte"; column: string; value: any }
  | { op: "in"; column: string; values: any[] };

type OrderBy = { column: string; ascending?: boolean };

interface ExecutePayload {
  table: string;
  action: "select" | "insert" | "update" | "delete" | "upsert";
  filters?: Filter[];
  orderBy?: OrderBy;
  columns?: string;
  values?: any | any[];
  single?: boolean;
  limit?: number;
}

class QueryBuilder<T = any> {
  private table: string;
  private filters: Filter[] = [];
  private orderBy?: OrderBy;
  private columns?: string;
  private limitValue?: number;
  private singleResult = false;
  private allowNullSingle = false;
  private pendingAction: ExecutePayload["action"] | null = null;
  private pendingValues: any;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*") {
    this.columns = columns;
    if (!this.pendingAction) this.pendingAction = "select";
    return this;
  }

  insert(values: any | any[]) {
    this.pendingAction = "insert";
    this.pendingValues = values;
    return this;
  }

  upsert(values: any | any[]) {
    this.pendingAction = "upsert";
    this.pendingValues = values;
    return this;
  }

  update(values: any) {
    this.pendingAction = "update";
    this.pendingValues = values;
    return this;
  }

  delete() {
    this.pendingAction = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  ilike(column: string, value: any) {
    this.filters.push({ op: "ilike", column, value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ op: "gte", column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ op: "lte", column, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ op: "in", column, values });
    return this;
  }

  order(column: string, opts: { ascending?: boolean } = {}) {
    this.orderBy = { column, ascending: opts.ascending ?? true };
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  maybeSingle() {
    this.singleResult = true;
    this.allowNullSingle = true;
    return this;
  }

  private async executePending<R>(): Promise<{ data: R | null; error: any }> {
    const action = this.pendingAction || "select";
    const payload: ExecutePayload = {
      table: this.table,
      action,
      filters: this.filters,
      orderBy: this.orderBy,
      columns: this.columns,
      single: this.singleResult,
      limit: this.limitValue,
      values: this.pendingValues,
    };

    try {
      const data = await apiClient.request<R>(`/db/${action}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (this.singleResult && !data && !this.allowNullSingle) {
        return { data: null, error: new Error("No rows found") };
      }
      return { data, error: null };
    } catch (error) {
      console.error("[supabase-shim]", action, this.table, error);
      return { data: null, error };
    }
  }

  // Make the builder "thenable" so `await supabase.from(...).select()` works.
  then<TResult1 = { data: T | null; error: any }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: T | null; error: any }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.executePending<T>().then(onfulfilled, onrejected);
  }
}

// Realtime/Channel shim to avoid breaking existing calls
class NoopChannel {
  on() { return this; }
  subscribe(cb?: (status: string) => void) {
    cb?.("SUBSCRIBED");
    return this;
  }
  unsubscribe() {
    return;
  }
}

let queryClient: any = null;
export const setQueryClient = (client: any) => {
  queryClient = client;
};

export const supabase = {
  from: <T = any>(table: string) => new QueryBuilder<T>(table),
  rpc: async (fn: string, params?: Record<string, any>) => {
    try {
      const data = await apiClient.request(`/rpc/${fn}`, {
        method: "POST",
        body: JSON.stringify(params || {}),
      });
      return { data, error: null };
    } catch (error) {
      console.error("[supabase-shim] rpc", fn, error);
      return { data: null, error };
    }
  },
  channel: (_name: string) => new NoopChannel(),
  removeChannel: (_channel: any) => {},
};
