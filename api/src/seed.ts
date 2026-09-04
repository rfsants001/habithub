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
  let created = 0;
  let existed = 0;

  for (const item of REAL_CATEGORIES) {
    const categoryBefore = db
      .select()
      .from(categories)
      .where(eq(categories.name, item.name))
      .get();
    const category = ensureCategory(item.name, item.colorHue);

    if (categoryBefore) {
      existed++;
      console.log(`  ↺ categoria "${item.name}" já existia (id ${category.id})`);
    } else {
      created++;
      console.log(`  ✚ categoria "${item.name}" criada (id ${category.id})`);
    }

    for (const habitName of item.habits) {
      const habitBefore = db
        .select()
        .from(habits)
        .where(and(eq(habits.name, habitName), eq(habits.categoryId, category.id)))
        .get();
      const habit = ensureHabit(habitName, category.id);

      if (habitBefore) {
        existed++;
        console.log(`    ↺ hábito "${habitName}" já existia (id ${habit.id})`);
      } else {
        created++;
        console.log(`    ✚ hábito "${habitName}" criado (id ${habit.id})`);
      }
    }
  }

  console.log(`\n✅ seed: ${created} criado(s), ${existed} já existia(m)`);
}

seed();
