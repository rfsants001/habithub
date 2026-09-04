import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { habits, categories } from "../db/schema";

export const habitsRepository = {
  list: () =>
    db
      .select({
        id: habits.id,
        name: habits.name,
        categoryId: habits.categoryId,
        categoryName: categories.name,
        colorHue: categories.colorHue,
      })
      .from(habits)
      .innerJoin(categories, eq(habits.categoryId, categories.id))
      .all(),

  findById: (id: number) =>
    db.select().from(habits).where(eq(habits.id, id)).get(),

  create: (input: { name: string; categoryId: number }) =>
    db.insert(habits).values(input).returning().get(),

  remove: (id: number) => db.delete(habits).where(eq(habits.id, id)).run(),
};
