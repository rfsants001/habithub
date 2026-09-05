import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { habits, categories, entries } from "../db/schema";
import { UpdateHabit } from "./../schemas/habit";

export const habitsRepository = {
  list: ({ includeArchived = false } = {}) =>
    db
      .select({
        id: habits.id,
        name: habits.name,
        categoryId: habits.categoryId,
        active: habits.active,
        categoryName: categories.name,
        color: categories.color,
      })
      .from(habits)
      .innerJoin(categories, eq(habits.categoryId, categories.id))
      .where(includeArchived ? undefined : eq(habits.active, true))
      .all(),

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
