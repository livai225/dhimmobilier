# Migration Supabase → MySQL + backend Node

## Objectif
Remplacer les appels directs Supabase sur le front par une API backend adossée à MySQL, tout en gardant le front buildable et déployable sous `/dhimmobilier/`.

## Architecture cible
- Backend Node (Fastify/Express/Nest) + Prisma/Drizzle sur MySQL.
- Auth JWT en cookie HttpOnly (`VITE_API_AUTH_COOKIE_NAME`), rôles admin/comptable/secretaire + table `user_permissions`.
- Realtime remplacé par Socket.io (émission `{table,event,id}`) ou polling ciblé.
- Front : couche `src/integrations/api` (fetch/axios) utilisée par les hooks/pages à la place de Supabase.

## Mapping des RPC Supabase → endpoints backend
- `get_current_cash_balance` → GET `/cash/balance/versement`
- `get_solde_caisse_entreprise` → GET `/cash/balance/entreprise`
- `record_cash_transaction` → POST `/cash/transactions`
- `record_sale_with_cash` → POST `/sales`
- `pay_location_with_cash` → POST `/payments/location`
- `pay_souscription_with_cash` → POST `/payments/souscription`
- `pay_droit_terre_with_cash` → POST `/payments/droit-terre`
- `pay_facture_with_cash` → POST `/payments/facture`
- `get_agent_statistics` → GET `/agents/:id/stats?month=YYYY-MM`
- `calculate_solde_droit_terre` → GET `/souscriptions/:id/solde-droit-terre`
- `delete_location_safely` → DELETE `/locations/:id?safe=true`
- `generate_facture_number` → POST `/factures/generate-number`
- `reconstruct_land_rights_config` → POST `/maintenance/reconstruct-land-rights`
- `create_missing_august_payments` → POST `/maintenance/create-missing-august-payments`

## Tables principales à modéliser (extrait `src/integrations/supabase/types.ts`)
`clients`, `proprietes`, `locations`, `souscriptions`, `paiements_locations`, `paiements_souscriptions`, `paiements_droit_terre`, `paiements_factures`, `paiements_cautions`, `factures_fournisseurs`, `fournisseurs`, `agents_recouvrement`, `cash_transactions`, `caisse_balance`, `recus`, `audit_logs`, `users`, `user_permissions`, `articles`, `ventes`, `receipt_counters`.

## Stratégie de migration front
1. **Abstraction d’accès** : créer `src/integrations/api/client.ts` (fetch/axios + interceptors auth) et un `dataService` exposant les opérations listées ci-dessus.
2. **Basculer les hooks/pages** :
   - Auth: `Login.tsx`, `useCurrentUser`, `useUserPermissions`, `useAuditLog`.
   - Caisse & balances: `BalanceBadge`, `pages/Caisse.tsx`.
   - Paiements: tous les `Paiement*Dialog.tsx`, `GroupedPaymentDialog`, `Import*`.
   - Reçus: `useReceipts`, `pages/Recus.tsx`.
   - Recouvrement: `AgentRecoveryDashboard`, `AgentOperationsDialog`, `pages/Recouvrement.tsx`.
   - CRUD génériques: `Clients`, `Proprietes`, `Locations`, `Souscriptions`, `Fournisseurs`, `Factures`, `Users`, `Settings`.
3. **Realtime** : injecter un `setQueryClient` équivalent qui écoute Socket.io; fallback polling sur clés critiques si WS indispo.
4. **Nettoyage** : supprimer `src/integrations/supabase/*` et variables Supabase quand toutes les pages consomment l’API.

## Checklist rapide
- [ ] Backend scaffold + schema Prisma MySQL à partir des tables ci-dessus.
- [ ] Endpoints REST/Socket.io implémentés (transactions MySQL pour les paiements).
- [ ] Front: créer `src/integrations/api` et basculer les hooks selon la liste.
- [ ] Tests API (Supertest) + e2e front (Playwright) sur login, paiement, reçu.
- [ ] Déploiement: ajouter service systemd backend + proxy_pass Nginx; front déjà servi sous `/dhimmobilier/`.

## Variables d’environnement (front)
Voir `.env.example` : `VITE_API_BASE_URL`, `VITE_API_AUTH_COOKIE_NAME`, (Supabase legacy).
