import fp from "fastify-plugin";
import jwt from "jsonwebtoken";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; role: string };
  }
}

const COOKIE_NAME = process.env.API_AUTH_COOKIE_NAME || "dhimmobilier_session";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export default fp(async (app) => {
  app.decorate("authenticate", async (req: any, reply: any) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
      reply.code(401);
      throw new Error("Not authenticated");
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = { id: decoded.sub, role: decoded.role };
    } catch (err) {
      reply.code(401);
      throw new Error("Not authenticated");
    }
  });
});
