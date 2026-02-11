import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { dbRoutes, authRoutes, cashRoutes, healthRoutes, usersRoutes, rpcRoutes } from "./routes/index.js";
import authPlugin from "./plugins/auth.js";
import socketEvents from "./plugins/socket-events.js";
import fastifyIO from "fastify-socket.io";
import { ensureDefaultTypesProprietes } from "./utils/ensure-default-types.js";

const app = Fastify({ logger: true });

// Configuration CORS - utiliser CORS_ORIGIN ou permettre toutes les origines en dev
const corsOrigin = process.env.CORS_ORIGIN;
const allowedOrigins = corsOrigin && corsOrigin !== "*"
  ? corsOrigin.split(",").map(o => o.trim())
  : true; // true = toutes les origines (dev mode)

await app.register(cors, {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
await app.register(cookie);
await app.register(authPlugin);
await app.register(socketEvents);
await app.register(fastifyIO, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  }
});

await dbRoutes(app);
await authRoutes(app);
await cashRoutes(app);
await healthRoutes(app);
await usersRoutes(app);
await rpcRoutes(app);

await ensureDefaultTypesProprietes();

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`API running on http://0.0.0.0:${port}`);
});
