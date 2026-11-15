import { count, eq, max, sql } from "drizzle-orm";
import { db } from "../db/client";
import { today, weekBounds } from "../db/date";
import { habits, categories, entries } from "../db/schema";
import type { CreateHabit, UpdateHabit } from "./../schemas/habit";

export const habitsRepository = {
  list: ({ includeArchived = false } = {}) => {
    const currentDate = today();
    const { start } = weekBounds();
    const rows = db
      .select({
        id: habits.id,
        name: habits.name,
        categoryId: habits.categoryId,
        active: habits.active,
        daysPerWeek: habits.daysPerWeek,
        weekDates: sql<string | null>`group_concat(distinct case when ${entries.date} between ${start} and ${currentDate} then ${entries.date} end)`,
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

    return rows.map(({ weekDates, ...row }) => {
      const dates = weekDates?.split(",").sort() ?? [];
      return { ...row, weekDates: dates, weekCount: dates.length, doneToday: row.lastDate === currentDate };
    });
  },

  update: (id: number, input: UpdateHabit) =>
    db.update(habits).set(input).where(eq(habits.id, id)).returning().get(),

  findById: (id: number) =>
    db.select().from(habits).where(eq(habits.id, id)).get(),

  create: (input: CreateHabit) =>
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
