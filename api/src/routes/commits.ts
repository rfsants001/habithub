import type { FastifyInstance } from "fastify";
import { habitsRepository } from "../repositories/habits";
import {
  createEntry,
  findEntriesOfYearByCategory,
} from "../repositories/entries";
import { idParamSchema } from "../schemas/common";
import { createCommitSchema } from "../schemas/commit";
import { buildGraph } from "../domain/graph";

export async function commitRoutes(app: FastifyInstance) {
  app.post("/:id/commit", async (req, res) => {
    const startedAt = performance.now();

    const { id } = idParamSchema.parse(req.params);
    const { message } = createCommitSchema.parse(req.body ?? {});

    const habit = habitsRepository.findById(id);

    if (!habit) {
      req.log.warn({ habitId: id }, "habit.not-found");
      return res.code(404).send({ error: "Hábito não cadastrado" });
    }

    const entry = createEntry(habit.id, message);
    // (F3) o commit git real entra aqui, ao lado — gitHabits.commit()

    req.log.info(
      {
        entryId: entry.id,
        habitId: habit.id,
        categoryId: habit.categoryId,
        date: entry.date,
        hasMessage: Boolean(message),
        messageLength: message?.length ?? 0,
      },
      "commit.created",
    );

    const year = new Date().getFullYear();
    const yearEntries = findEntriesOfYearByCategory(habit.categoryId, year);
    const weeks = buildGraph(yearEntries, year);

    const totalForDay = yearEntries.filter(
      (e) => e.date === entry.date,
    ).length;
    req.log.debug({ date: entry.date, totalForDay }, "commit.day.counted");

    req.log.debug(
      { durationMs: Math.round(performance.now() - startedAt) },
      "commit.completed",
    );

    return res.code(201).send({
      categoryId: habit.categoryId,
      year,
      weeks,
    });
  });
}
