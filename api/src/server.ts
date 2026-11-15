import { pathToFileURL } from "node:url";

import Fastify from "fastify";
import type { FastifyError } from "fastify";
import { ZodError } from "zod";
import { migrateDatabase } from "./db/migrate";
import { today, weekBounds } from "./db/date";
import { habitsRepository } from "./repositories/habits";
import { categoriesRepository } from "./repositories/categories";
import { exportBackup } from "./db/backup";

import { loggerOptions } from "./logger";
import { categoryRoutes } from "./routes/categories";
import { habitsRoutes } from "./routes/habits";
import { commitRoutes } from "./routes/commits";

export function createServer() {
  const app = Fastify({ logger: loggerOptions });

  app.addHook("onRequest", async (req, res) => {
    res.header("Cache-Control", "no-store");
    if (["same-site", "cross-site"].includes(String(req.headers["sec-fetch-site"]))) {
      return res.code(403).send({ error: "Abra o HabitHub em seu endereço habitual." });
    }
  });

  app.get("/overview", async () => ({
    today: today(),
    week: weekBounds(),
    categories: categoriesRepository.list(),
    habits: habitsRepository.list({ includeArchived: true }),
  }));

  app.get("/backup", async (_req, res) => {
    res.header("Content-Disposition", 'attachment; filename="habithub-backup.json"');
    return exportBackup();
  });

  app.get("/health", { logLevel: "silent" }, async () => {
    return { status: "ok" };
  });

  app.register(categoryRoutes, { prefix: "/categories" });
  app.register(habitsRoutes, { prefix: "/habits" });
  app.register(commitRoutes, { prefix: "/habits" });

  app.setErrorHandler((err, req, res) => {
    if (err instanceof ZodError) {
      req.log.warn(
        {
          fields: err.issues.map((issue) => ({
            field: issue.path.join("."),
            code: issue.code,
          })),
        },
        "validation.failed",
      );

      return res.code(400).send({
        error: err.issues[0]?.message ?? "Dados inválidos",
        fields: err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const error = err as FastifyError;

    if (error.statusCode && error.statusCode < 500) {
      req.log.warn({ status: error.statusCode }, "request.rejected");
      return res.code(error.statusCode).send({ error: error.message });
    }

    req.log.error({ err: error }, "error.unhandled");

    return res.code(500).send({
      error: "Algo quebrou do nosso lado. Tenta de novo.",
      reqId: req.id,
    });
  });

  app.setNotFoundHandler((req, res) => {
    res.code(404).send({
      error: `Rota não encontrada: ${req.method} ${req.url}`,
    });
  });

  return app;
}

const executadoDireto =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDireto) {
  migrateDatabase();
  const app = createServer();
  const port = Number(process.env.PORT ?? 3000);

  app
    .listen({ port, host: process.env.SERVER_HOST ?? "127.0.0.1" })
    .then((address) =>
      app.log.info(
        { address, pid: process.pid, node: process.version },
        "api.started",
      ),
    )
    .catch((err) => {
      app.log.error(err, "api.start-failed");
      process.exit(1);
    });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      app.log.info({ signal }, "api.shutting-down");
      await app.close();
      process.exit(0);
    });
  }
}
