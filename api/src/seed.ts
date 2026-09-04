import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import { categories, habits } from "./db/schema";

const REAL_CATEGORIES = [
  { name: "Saúde", colorHue: 120, habits: ["Academia", "Caminhada"] },
  { name: "Estudo", colorHue: 210, habits: ["Leitura", "JS/TS"] },
  { name: "Trabalho", colorHue: 280, habits: ["Deep work"] },
];

function ensureCategory(name: string, colorHue: number) {
  const existing = db
    .select()
    .from(categories)
    .where(eq(categories.name, name))
    .get();
  if (existing) return existing;
  return db.insert(categories).values({ name, colorHue }).returning().get();
}

function ensureHabit(name: string, categoryId: number) {
  const existing = db
    .select()
    .from(habits)
    .where(and(eq(habits.name, name), eq(habits.categoryId, categoryId)))
    .get();
  if (existing) return existing;
  return db.insert(habits).values({ name, categoryId }).returning().get();
}

function seed() {
  for (const item of REAL_CATEGORIES) {
    const category = ensureCategory(item.name, item.colorHue);
    for (const habitName of item.habits) {
      ensureHabit(habitName, category.id);
    }
  }
  console.log("✅ categorias e hábitos garantidos");
}

seed();
