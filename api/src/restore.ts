import { readFileSync } from "node:fs";

async function main() {
  const file = process.argv[2];
  if (!file || !process.env.DB_FILE || process.env.DB_FILE === ":memory:") {
    throw new Error("Informe DB_FILE com um novo banco e o caminho para habithub-backup.json.");
  }
  const input: unknown = JSON.parse(readFileSync(file, "utf8"));
  const { migrateDatabase } = await import("./db/migrate");
  const { importBackup } = await import("./db/backup");
  migrateDatabase();
  importBackup(input);
  console.log("Backup restaurado.");
}

void main().catch(() => {
  console.error("Não foi possível restaurar. Informe um backup válido e um caminho DB_FILE para um banco vazio.");
  process.exitCode = 1;
});
