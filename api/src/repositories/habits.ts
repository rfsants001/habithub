import { count, eq, max } from "drizzle-orm";
import { db } from "../db/client";
import { today } from "../db/date";
import { habits, categories, entries } from "../db/schema";
import { UpdateHabit } from "./../schemas/habit";

export const habitsRepository = {
  list: ({ includeArchived = false } = {}) => {
    const rows = db
      .select({
        id: habits.id,
        name: habits.name,
        categoryId: habits.categoryId,
        active: habits.active,
        categoryName: categories.name,
        color: categories.color,
        totalCommits: count(entries.id),
        lastDate: max(entries.date),
      })
      .from(habits)
      .innerJoin(categories, eq(habits.categoryId, categories.id))
      .leftJoin(entries, eq(entries.habitId, habits.id))
      .where(includeArchived ? undefined : eq(habits.active, true))
      .groupBy(habits.id)
      .all();

    const hoje = today();

    return rows.map((row) => ({ ...row, doneToday: row.lastDate === hoje }));
  },

  update: (id: number, input: UpdateHabit) =>
    db.update(habits).set(input).where(eq(habits.id, id)).returning().get(),

  findById: (id: number) =>
    db.select().from(habits).where(eq(habits.id, id)).get(),

  create: (input: { name: string; categoryId: number }) =>
    db.insert(habits).values(input).returning().get(),

  hasEntries: (id: number) => {
    const found = db
      .select({ id: entries.id })
      .from(entries)
      .where(eq(entries.habitId, id))
      .get();

    return found !== undefined;
  },

  remove: (id: number) => db.delete(habits).where(eq(habits.id, id)).run(),
};
