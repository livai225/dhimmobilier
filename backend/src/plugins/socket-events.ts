import fp from "fastify-plugin";

export default fp(async (app) => {
  app.decorate("emitChange", (table: string, action: string) => {
    app.io?.emit("db-change", { table, action });
  });
});
