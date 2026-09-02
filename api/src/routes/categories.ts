import type { FastifyInstance } from "fastify";
import { categoriesRepository } from "../repositories/categories";
import { createCategorySchema } from "../schemas/category";
import { idParamSchema } from "../schemas/common";

export async function categoryRoutes(app: FastifyInstance) {
  app.get("/", async () => categoriesRepository.list());

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
