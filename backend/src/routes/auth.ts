import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Avertissement si JWT_SECRET n'est pas défini en production
if (IS_PRODUCTION && !process.env.JWT_SECRET) {
  console.warn("⚠️  WARNING: JWT_SECRET n'est pas défini en production!");
}
const COOKIE_NAME = process.env.API_AUTH_COOKIE_NAME || "dhimmobilier_session";
// secure: true uniquement si HTTPS est configuré (variable HTTPS_ENABLED=true)
const USE_SECURE_COOKIE = process.env.HTTPS_ENABLED === "true";
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: USE_SECURE_COOKIE,
};

// Exclure le password_hash des réponses utilisateur
function sanitizeUser(user: any) {
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (req, reply) => {
    const { username, password } = req.body as { username: string; password: string };

    // Validation des entrées
    if (!username || !password) {
      reply.code(400);
      return { error: "Nom d'utilisateur et mot de passe requis" };
    }

    const user = await prisma.users.findUnique({ where: { username } });
    if (!user || !user.password_hash) {
      reply.code(401); return { error: "Invalid credentials" };
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) { reply.code(401); return { error: "Invalid credentials" }; }

    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
    reply.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    return { user: sanitizeUser(user) };
  });

  app.get("/auth/me", async (req, reply) => {
    try {
      const token = req.cookies[COOKIE_NAME];
      if (!token) { reply.code(401); return { error: "Not authenticated" }; }
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = await prisma.users.findUnique({ where: { id: decoded.sub } });
      if (!user) { reply.code(401); return { error: "Not authenticated" }; }
      return { user: sanitizeUser(user) };
    } catch (err) {
      reply.code(401);
      return { error: "Not authenticated" };
    }
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
    return { success: true };
  });
}
