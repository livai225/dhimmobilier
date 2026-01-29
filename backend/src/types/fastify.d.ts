import { FastifyInstance } from "fastify";
import { Server as SocketIOServer } from "socket.io";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    io?: SocketIOServer;
  }

  interface FastifyRequest {
    user?: {
      id: string;
      role: string;
    };
  }
}
