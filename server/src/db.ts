import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function openDb(filePath: string): DatabaseSync {
  const isNew = filePath === ":memory:" || !fs.existsSync(filePath);
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA foreign_keys = ON;");
  if (isNew) {
    const schemaPath = path.join(__dirname, "..", "..", "docs", "SCHEMA.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    db.exec(schema);
  }
  return db;
}

export type Row = Record<string, any>;
