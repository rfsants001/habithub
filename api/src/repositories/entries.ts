import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client";
import { entries, habits } from "../db/schema";
import { today } from "../db/date";
import type { CreateCommit } from "../schemas/commit";

export function findEntriesOfYearByCategory(categoryId: number, year: number) {
  return db
    .select({ date: entries.date, message: entries.message })
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

export function recordDay(habitId: number, input: CreateCommit) {
  const date = input.date ?? today();
  return db.transaction((tx) => {
    const existing = tx.select().from(entries)
      .where(and(eq(entries.habitId, habitId), eq(entries.date, date)))
      .orderBy(asc(entries.id)).get();
    if (existing) return { entry: existing, created: false };
    const entry = tx.insert(entries).values({ habitId, date, message: input.message }).returning().get();
    return { entry, created: true };
  }, { behavior: "immediate" });
}

export function entriesForMonth(habitId: number, month: string) {
  return db.select({ id: entries.id, date: entries.date, message: entries.message })
    .from(entries)
    .where(and(eq(entries.habitId, habitId), gte(entries.date, `${month}-01`), lte(entries.date, `${month}-31`)))
    .orderBy(asc(entries.date), asc(entries.id)).all();
}

export function removeEntry(habitId: number, entryId: number) {
  db.delete(entries).where(and(eq(entries.habitId, habitId), eq(entries.id, entryId))).run();
}
