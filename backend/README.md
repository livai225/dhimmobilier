# Backend API (Fastify + Prisma + MySQL)

## Démarrage local
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Variables d'environnement importantes :
- `DATABASE_URL` : URL MySQL (par ex. mysql://user:pass@localhost:3306/dhimmobilier)
- `PORT` : (optionnel) port de l'API (défaut 3000)
- `JWT_SECRET` : secret pour les tokens
- `API_AUTH_COOKIE_NAME` : (optionnel) nom du cookie auth (défaut dhimmobilier_session)

## Endpoints couverts
- Auth : `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- DB générique : `POST /db/{select|insert|update|delete|upsert}`
- RPC placeholder : `POST /rpc/:fn` (à implémenter)
- Caisse : `GET /cash/balance/versement`, `GET /cash/balance/entreprise`
- Permissions : `GET /users/:id/permissions`

Voir `MIGRATION_MYSQL.md` (racine) pour le mapping complet des anciens RPC Supabase à implémenter côté `/rpc/*` ou en endpoints dédiés.
