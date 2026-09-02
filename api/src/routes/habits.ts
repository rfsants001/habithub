import type { FastifyInstance } from "fastify";
import { habitsRepository } from "../repositories/habits";
import { createHabitSchema } from "../schemas/habit";
import { idParamSchema } from "../schemas/common";

export async function habitsRoutes(app: FastifyInstance) {
  app.get("/", async () => habitsRepository.list());

  app.post("/", async (req, res) => {
    const input = createHabitSchema.parse(req.body);
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

    habitsRepository.remove(id);
    req.log.info({ habitId: id }, "habit.deleted");
    return res.code(204).send();
  });
}
