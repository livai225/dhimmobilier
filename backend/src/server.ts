import Fastify from "fastify";
import compress from "@fastify/compress";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { dbRoutes, authRoutes, cashRoutes, healthRoutes, usersRoutes, rpcRoutes } from "./routes/index.js";
import authPlugin from "./plugins/auth.js";
import socketEvents from "./plugins/socket-events.js";
import fastifyIO from "fastify-socket.io";
import { ensureDefaultTypesProprietes } from "./utils/ensure-default-types.js";
import { prisma } from "./lib/prisma.js";

const app = Fastify({ logger: true });

// Graceful shutdown
async function shutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down gracefully...`);
  try {
    await app.close();
    await prisma.$disconnect();
    app.log.info("Server closed cleanly");
  } catch (err) {
    app.log.error(err, "Error during shutdown");
  }
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function warmupDefaultTypes(maxAttempts = 10, retryDelayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await ensureDefaultTypesProprietes();
      app.log.info("Default property types initialization completed");
      return;
    } catch (error) {
      app.log.warn(
        { err: error, attempt, maxAttempts },
        "Failed to initialize default property types",
      );

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  app.log.error(
    "Default property types initialization skipped after retries; API will keep running",
  );
}

// Configuration CORS - utiliser CORS_ORIGIN ou permettre toutes les origines en dev
const corsOrigin = process.env.CORS_ORIGIN;
const allowedOrigins = corsOrigin && corsOrigin !== "*"
  ? corsOrigin.split(",").map(o => o.trim())
  : true; // true = toutes les origines (dev mode)

await app.register(compress);
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

const port = Number(process.env.PORT || 3000);
await app.listen({ port, host: "0.0.0.0" });
app.log.info(`API running on http://0.0.0.0:${port}`);

// Warmup après le démarrage du serveur, dans un try/catch isolé
try {
  await warmupDefaultTypes();
} catch (err) {
  app.log.error(err, "Warmup failed, server continues without default types");
}
