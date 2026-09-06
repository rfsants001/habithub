import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { entries, habits } from "./db/schema";
import { formatDate } from "./db/date";

const DAYS = 120;
const CHANCE_DE_TER_FEITO = 0.55;
const CHANCE_DE_REPETIR = 0.2;

function seedHistory(habitId: number, habitName: string) {
  const alreadySeeded = db
    .select({ id: entries.id })
    .from(entries)
    .where(eq(entries.habitId, habitId))
    .get();

  if (alreadySeeded) {
    console.log(`  ↺ "${habitName}" já tem histórico, não vou duplicar`);
    return { inserted: 0, days: 0 };
  }

  let inserted = 0;
  let days = 0;

  for (let dayOffset = 0; dayOffset < DAYS; dayOffset++) {
    const day = new Date();
    day.setDate(day.getDate() - dayOffset);

    if (Math.random() > 1 - CHANCE_DE_TER_FEITO) {
      const times = Math.random() > 1 - CHANCE_DE_REPETIR ? 3 : 1;
      for (let i = 0; i < times; i++) {
        db.insert(entries).values({ habitId, date: formatDate(day) }).run();
        inserted++;
      }
      days++;
    }
  }

  console.log(`  ✚ "${habitName}": ${inserted} entries em ${days} dias`);
  return { inserted, days };
}

function seedDemo() {
  console.warn(
    "⚠️  seed:demo insere histórico FICTÍCIO. Backup: cp habithub.db habithub.db.bak\n",
  );

  const todos = db
    .select({ id: habits.id, name: habits.name })
    .from(habits)
    .all();

  if (todos.length === 0) {
    console.log("Nenhum hábito no banco. Rode `npm run seed` primeiro.");
    return;
  }

  let inserted = 0;
  let days = 0;

  for (const habit of todos) {
    const r = seedHistory(habit.id, habit.name);
    inserted += r.inserted;
    days += r.days;
  }

  console.log(`\n✅ demo: ${inserted} entries em ${days} dias, ${todos.length} hábito(s)`);
}

seedDemo();
