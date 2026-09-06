import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import { categories, entries, habits } from "./db/schema";
import { formatDate } from "./db/date";

const DAYS = 240;

type HabitPlan = {
  name: string;
  chance: number;
  repeat: number;
  doneToday: boolean;
  messages: string[];
};

type CategoryPlan = {
  name: string;
  color: string;
  habits: HabitPlan[];
};

const SHOWCASE: CategoryPlan[] = [
  {
    name: "Casa",
    color: "#f0883e",
    habits: [
      {
        name: "Arrumar a cozinha",
        chance: 0.72,
        repeat: 0.1,
        doneToday: true,
        messages: ["depois do almoço", "louça em dia"],
      },
      {
        name: "Regar as plantas",
        chance: 0.34,
        repeat: 0,
        doneToday: false,
        messages: ["a samambaia sobreviveu"],
      },
    ],
  },
  {
    name: "Finanças",
    color: "#e3b341",
    habits: [
      {
        name: "Lançar gastos",
        chance: 0.61,
        repeat: 0.05,
        doneToday: true,
        messages: ["mercado + gasolina", "fechei a semana"],
      },
      {
        name: "Revisar assinaturas",
        chance: 0.12,
        repeat: 0,
        doneToday: false,
        messages: ["cancelei uma que nem usava"],
      },
    ],
  },
  {
    name: "Criativo",
    color: "#ec6cb9",
    habits: [
      {
        name: "Escrever roteiro",
        chance: 0.45,
        repeat: 0.28,
        doneToday: true,
        messages: ["EP01 fechado", "reescrevi a abertura", "três takes"],
      },
      {
        name: "Desenhar 15min",
        chance: 0.27,
        repeat: 0,
        doneToday: false,
        messages: [],
      },
    ],
  },
];

function ensureCategory(name: string, color: string) {
  const existing = db
    .select()
    .from(categories)
    .where(eq(categories.name, name))
    .get();

  return existing ?? db.insert(categories).values({ name, color }).returning().get();
}

function ensureHabit(name: string, categoryId: number) {
  const existing = db
    .select()
    .from(habits)
    .where(and(eq(habits.name, name), eq(habits.categoryId, categoryId)))
    .get();

  return existing ?? db.insert(habits).values({ name, categoryId }).returning().get();
}

function hasHistory(habitId: number) {
  return (
    db
      .select({ id: entries.id })
      .from(entries)
      .where(eq(entries.habitId, habitId))
      .get() !== undefined
  );
}

function seedHistory(habitId: number, plan: HabitPlan) {
  const year = new Date().getFullYear();
  let inserted = 0;
  let messagesUsed = 0;

  for (let offset = plan.doneToday ? 1 : 0; offset < DAYS; offset++) {
    const day = new Date();
    day.setDate(day.getDate() - offset);

    if (day.getFullYear() !== year) break;
    if (Math.random() > plan.chance) continue;

    const times = Math.random() < plan.repeat ? 2 + Math.floor(Math.random() * 3) : 1;

    for (let i = 0; i < times; i++) {
      const message =
        i === 0 && messagesUsed < plan.messages.length && Math.random() < 0.12
          ? plan.messages[messagesUsed++]
          : null;

      db.insert(entries).values({ habitId, date: formatDate(day), message }).run();
      inserted++;
    }
  }

  if (plan.doneToday) {
    const hoje = formatDate(new Date());
    const times = 1 + Math.floor(Math.random() * 3);

    for (let i = 0; i < times; i++) {
      db.insert(entries)
        .values({
          habitId,
          date: hoje,
          message: i === 0 ? (plan.messages[0] ?? null) : null,
        })
        .run();
      inserted++;
    }
  }

  return inserted;
}

function seedShowcase() {
  console.warn(
    "⚠️  seed:showcase cria categorias e commits FICTÍCIOS, só para demonstração.\n" +
      "    Backup antes: cp habithub.db habithub.db.bak\n",
  );

  let categoriasCriadas = 0;
  let habitosCriados = 0;
  let entriesCriadas = 0;

  for (const plan of SHOWCASE) {
    const existiaCategoria = db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.name, plan.name))
      .get();

    const category = ensureCategory(plan.name, plan.color);

    if (existiaCategoria) {
      console.log(`  ↺ categoria "${plan.name}" já existia (id ${category.id})`);
    } else {
      categoriasCriadas++;
      console.log(`  ✚ categoria "${plan.name}" criada (id ${category.id}) ${plan.color}`);
    }

    for (const habitPlan of plan.habits) {
      const existiaHabito = db
        .select({ id: habits.id })
        .from(habits)
        .where(and(eq(habits.name, habitPlan.name), eq(habits.categoryId, category.id)))
        .get();

      const habit = ensureHabit(habitPlan.name, category.id);
      if (!existiaHabito) habitosCriados++;

      if (hasHistory(habit.id)) {
        console.log(`    ↺ "${habitPlan.name}" já tem histórico, não vou duplicar`);
        continue;
      }

      const inserted = seedHistory(habit.id, habitPlan);
      entriesCriadas += inserted;
      console.log(
        `    ✚ "${habitPlan.name}": ${inserted} commits` +
          (habitPlan.doneToday ? " (feito hoje ✓)" : " (não feito hoje ○)"),
      );
    }
  }

  console.log(
    `\n✅ showcase: ${categoriasCriadas} categoria(s), ${habitosCriados} hábito(s), ` +
      `${entriesCriadas} commit(s)`,
  );
}

seedShowcase();
