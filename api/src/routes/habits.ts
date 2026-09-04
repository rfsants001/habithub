import type { FastifyInstance } from "fastify";
import { categoriesRepository } from "../repositories/categories";
import { habitsRepository } from "../repositories/habits";
import {
  createHabitSchema,
  listHabitsQuerySchema,
  updateHabitSchema,
} from "../schemas/habit";
import { idParamSchema } from "../schemas/common";

export async function habitsRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const { includeArchived } = listHabitsQuerySchema.parse(req.query);
    return habitsRepository.list({ includeArchived });
  });

  app.patch("/:id", async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { active } = updateHabitSchema.parse(req.body);

    if (!habitsRepository.findById(id)) {
      req.log.warn({ habitId: id }, "habit.not-found");
      return res.code(404).send({ error: "Hábito não encontrado" });
    }

    const habit = habitsRepository.setActive(id, active);
    req.log.info({ habitId: id, active }, "habit.archived");
    return res.send(habit);
  });

  app.post("/", async (req, res) => {
    const input = createHabitSchema.parse(req.body);

    if (!categoriesRepository.findById(input.categoryId)) {
      req.log.warn({ categoryId: input.categoryId }, "category.not-found");
      return res.code(404).send({ error: "Categoria não encontrada" });
    }

    const habit = habitsRepository.create(input);
    req.log.info({ habitId: habit.id, name: habit.name }, "habit.created");
    return res.code(201).send(habit);
  });

  app.delete("/:id", async (req, res) => {
    const { id } = idParamSchema.parse(req.params);

    if (!habitsRepository.findById(id)) {
      req.log.warn({ habitId: id }, "habit.not-found");
      return res.code(404).send({ error: "Hábito não encontrado" });
    }

    if (habitsRepository.hasEntries(id)) {
      req.log.warn({ habitId: id }, "habit.delete.blocked");
      return res.code(409).send({
        error: "Este hábito já tem commits. O histórico não é apagado.",
      });
    }

    habitsRepository.remove(id);
    req.log.info({ habitId: id }, "habit.deleted");
    return res.code(204).send();
  });
}
