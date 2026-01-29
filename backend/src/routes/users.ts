import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

export async function usersRoutes(app: FastifyInstance) {
  app.get("/users/:id/permissions", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const perms = await prisma.user_permissions.findMany({
      where: { user_id: id },
      select: { permission_name: true, granted: true },
    });
    return perms;
  });
}
