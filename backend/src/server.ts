import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { dbRoutes, authRoutes, cashRoutes, usersRoutes, rpcRoutes } from "./routes/index.js";
import authPlugin from "./plugins/auth.js";
import socketEvents from "./plugins/socket-events.js";
import fastifyIO from "fastify-socket.io";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true,
});
await app.register(cookie);
await app.register(authPlugin);
await app.register(socketEvents);
await app.register(fastifyIO, { cors: { origin: true, credentials: true } });

await dbRoutes(app);
await authRoutes(app);
await cashRoutes(app);
await usersRoutes(app);
await rpcRoutes(app);

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`API running on http://0.0.0.0:${port}`);
});
