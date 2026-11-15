import { z } from "zod";
import { db } from "./client";
import { categories, habits, entries } from "./schema";
import { isRealDay } from "../schemas/commit";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.string().min(1).max(64);
const backupSchema = z.object({
  version: z.literal(1),
  categories: z.array(z.object({ id, name: z.string().min(1), color: z.string().regex(/^#[\da-f]{6}$/i), createdAt: timestamp })),
  habits: z.array(z.object({
    id, name: z.string().min(1), categoryId: id, daysPerWeek: z.number().int().min(1).max(7),
    windowStart: z.string().nullable(), windowEnd: z.string().nullable(), active: z.boolean(), createdAt: timestamp,
  })),
  entries: z.array(z.object({
    id, habitId: id, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDay),
    createdAt: timestamp, message: z.string().nullable(),
  })),
});

export function exportBackup() {
  return db.transaction((tx) => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: tx.select().from(categories).all(),
    habits: tx.select().from(habits).all(),
    entries: tx.select().from(entries).all(),
  }));
}

export function importBackup(input: unknown) {
  const data = backupSchema.parse(input);
  db.transaction((tx) => {
    if (tx.select({ id: categories.id }).from(categories).limit(1).get() ||
        tx.select({ id: habits.id }).from(habits).limit(1).get() ||
        tx.select({ id: entries.id }).from(entries).limit(1).get()) {
      throw new Error("Restaure o backup em um banco vazio.");
    }
    for (const category of data.categories) tx.insert(categories).values(category).run();
    for (const habit of data.habits) tx.insert(habits).values(habit).run();
    for (const entry of data.entries) tx.insert(entries).values(entry).run();
  }, { behavior: "immediate" });
}
