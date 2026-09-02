import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import pino from "pino";
import { loggerOptions } from "../logger";
import * as schema from "./schema";

const log = pino(loggerOptions).child({ module: "db" });
const DATABASE_FILE = process.env.DB_FILE ?? "habithub.db";
const sqlite = new Database(DATABASE_FILE);
sqlite.pragma("forein_keys = ON");

log.info({ file: DATABASE_FILE, foreignKeys: true }, "db.connected");

export const db = drizzle(sqlite, {
  schema,
  logger: process.env.DEBUG_SQL === "1",
});
