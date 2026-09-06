import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "../db/client";

// O banco em memória nasce vazio; aplica as migrations pra ele ter o schema real.
migrate(db, { migrationsFolder: "src/db/migrations" });
