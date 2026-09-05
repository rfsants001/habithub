import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client";
import { entries, habits } from "../db/schema";
import { today } from "../db/date";
import { CreateCommit } from "../schemas/commit";

export function findEntriesOfYearByCategory(categoryId: number, year: number) {
  return db
    .select({ date: entries.date })
    .from(entries)
    .innerJoin(habits, eq(entries.habitId, habits.id))
    .where(
      and(
        eq(habits.categoryId, categoryId),
        gte(entries.date, `${year}-01-01`),
        lte(entries.date, `${year}-12-31`),
      ),
    )
    .all();
}

export function createEntry(habitId: number, input: CreateCommit) {
  return db
    .insert(entries)
    .values({ habitId, date: input.date ?? today(), message: input.message })
    .returning()
    .get();
}
