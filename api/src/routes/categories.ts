import type { FastifyInstance } from "fastify";
import { categoriesRepository } from "../repositories/categories";
import { createCategorySchema } from "../schemas/category";
import { idParamSchema } from "../schemas/common";
import { findEntriesOfYearByCategory } from "../repositories/entries";
import { buildGraph } from "../domain/graph";

export async function categoryRoutes(app: FastifyInstance) {
  app.get("/", async () => categoriesRepository.list());

  app.get("/:id/graph", async (req, res) => {
    const { id } = idParamSchema.parse(req.params);

    const category = categoriesRepository.findById(id);
    if (!category) {
      req.log.warn({ categoryId: id }, "category.not-found");
      return res.code(404).send({ error: "Categoria não encontrada" });
    }

    const year = new Date().getFullYear();
    const queryStartedAt = performance.now();
    const entries = findEntriesOfYearByCategory(id, year);
    const queryMs = performance.now() - queryStartedAt;

    const aggregationStartedAt = performance.now();
    const weeks = buildGraph(entries, year);
    const aggregationMs = performance.now() - aggregationStartedAt;

    const metrics = {
      categoryId: id,
      year,
      totalEntries: entries.length,
      daysWithCommit: weeks.flat().filter((day) => day && day.total > 0).length,
      weeks: weeks.length,
      queryMs: Math.round(queryMs),
      aggregationMs: Math.round(aggregationMs),
    };

    req.log.debug(metrics, "graph.built");

    if (queryMs + aggregationMs > 50) req.log.warn(metrics, "graph.slow");

    return {
      category: {
        id: category.id,
        name: category.name,
        color: category.color,
      },
      year,
      weeks,
    };
  });

  app.post("/", async (req, res) => {
    const input = createCategorySchema.parse(req.body);
    const category = categoriesRepository.create(input);

    req.log.info(
      { categoryId: category.id, name: category.name },
      "category.created",
    );
    return res.code(201).send(category);
  });

  app.delete("/:id", async (req, res) => {
    const { id } = idParamSchema.parse(req.params);

    if (!categoriesRepository.findById(id)) {
      req.log.warn({ categoryId: id }, "category.not-found");
      return res.code(404).send({ error: "Category não encontrada" });
    }

    if (categoriesRepository.hasHabits(id)) {
      req.log.warn({ categoryId: id }, "category.delete.blocked");
      return res.code(409).send({
        error:
          "Esta categoria ainda tem hábitos. Apague ou mova os hábitos primeiro.",
      });
    }

    categoriesRepository.remove(id);
    req.log.info({ categoryId: id }, "category.deleted");
    return res.code(204).send();
  });
}
