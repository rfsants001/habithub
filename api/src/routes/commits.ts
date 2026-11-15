import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { today } from "../db/date";
import { habitsRepository } from "../repositories/habits";
import {
  recordDay,
  entriesForMonth,
  removeEntry,
  findEntriesOfYearByCategory,
} from "../repositories/entries";
import { idParamSchema } from "../schemas/common";
import { createCommitSchema } from "../schemas/commit";
import { buildGraph } from "../domain/graph";

export async function commitRoutes(app: FastifyInstance) {
  app.post("/:id/commit", async (req, res) => {
    const startedAt = performance.now();

    const { id } = idParamSchema.parse(req.params);
    const input = createCommitSchema.parse(req.body ?? {});

    const habit = habitsRepository.findById(id);

    if (!habit) {
      req.log.warn({ habitId: id }, "habit.not-found");
      return res.code(404).send({ error: "Hábito não cadastrado" });
    }

    if (!habit.active) return res.code(409).send({ error: "Restaure o hábito antes de registrar um dia." });
    const { entry, created } = recordDay(habit.id, input);

    if (created) req.log.info(
      {
        entryId: entry.id,
        habitId: habit.id,
        categoryId: habit.categoryId,
        date: entry.date,
        hasMessage: Boolean(input.message),
        messageLength: input.message?.length ?? 0,
      },
      "commit.created",
    );

    const year = Number(entry.date.slice(0, 4));
    const yearEntries = findEntriesOfYearByCategory(habit.categoryId, year);
    const weeks = buildGraph(yearEntries, year);

    const dia = weeks.flat().find((day) => day?.date === entry.date);
    req.log.debug(
      { date: entry.date, totalForDay: dia?.total ?? 0 },
      "commit.day.counted",
    );

    req.log.debug(
      { durationMs: Math.round(performance.now() - startedAt) },
      "commit.completed",
    );

    return res.code(created ? 201 : 200).send({
      created,
      entryId: entry.id,
      date: entry.date,
      categoryId: habit.categoryId,
      year,
      weeks,
    });
  });

  app.get("/:id/history", async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { month } = z.object({ month: z.string().regex(/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/, "Escolha um mês válido") }).parse(req.query);
    if (!habitsRepository.findById(id)) return res.code(404).send({ error: "Hábito não encontrado" });
    if (month > today().slice(0, 7)) return res.code(400).send({ error: "Escolha um mês até o mês atual" });
    return { month, entries: entriesForMonth(id, month) };
  });

  app.delete("/:id/entries/:entryId", async (req, res) => {
    const { id, entryId } = idParamSchema.extend({ entryId: z.coerce.number().int().positive() }).parse(req.params);
    removeEntry(id, entryId);
    return res.code(204).send();
  });
}
