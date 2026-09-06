import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { categories, habits } from "../db/schema";
import type { CreateCategory, UpdateCategory } from "../schemas/category";

export const categoriesRepository = {
  list: () => db.select().from(categories).all(),

  findById: (id: number) =>
    db.select().from(categories).where(eq(categories.id, id)).get(),

  create: (input: CreateCategory) =>
    db.insert(categories).values(input).returning().get(),

  update: (id: number, input: UpdateCategory) =>
    db
      .update(categories)
      .set(input)
      .where(eq(categories.id, id))
      .returning()
      .get(),

  hasHabits: (id: number) => {
    const found = db
      .select({ id: habits.id })
      .from(habits)
      .where(eq(habits.categoryId, id))
      .get();

    return found !== undefined;
  },

  remove: (id: number) =>
    db.delete(categories).where(eq(categories.id, id)).run(),
};
