import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { InferSelectModel } from "drizzle-orm";

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  colorHue: integer("color_hue").notNull().default(120),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const habits = sqliteTable("habits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id),
  windowStart: text("window_start"),
  windowEnd: text("window_end"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const entries = sqliteTable("entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  habitId: integer("habit_id")
    .notNull()
    .references(() => habits.id),
  date: text("date").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  message: text("message"),
});
