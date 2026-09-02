import Fastify from "fastify";
import cors from "@fastify/cors";

import { loggerOptions } from "./logger";
import { categoryRoutes } from "./routes/categories";
import { habitsRoutes } from "./routes/habits";

export function createServer() {
  const app = Fastify({ logger: loggerOptions });

  app.register(cors, { origin: true });

  app.get("/health", { logLevel: "silent" }, async () => {
    return { status: "ok" };
  });
  return app;
}

const app = createServer();
app
  .listen({ port: 3000, host: "0.0.0.0" })
  .then((address) =>
    app.log.info(
      { address, pid: process.pid, node: process.version },
      "api.started",
    ),
  )
  .catch((err) => {
    app.log.error(err, "api.failed");
    process.exit(1);
  });

app.register(categoryRoutes, { prefix: "/categories" });
app.register(habitsRoutes, { prefix: "/habits" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    app.log.info({ signal }, "api.shutting-down");
    await app.close();
    process.exit(0);
  });
}
