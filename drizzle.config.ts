// Drizzle Kit config.
//
//   npm run db:generate   # generate SQL migrations from lib/db/schema.ts
//   npm run db:migrate    # apply them to the Neon database in DATABASE_URL
//
// drizzle-kit runs outside Next.js, so it does not auto-load .env.local — we
// parse it here (no extra dependency) when DATABASE_URL isn't already exported.
import { existsSync, readFileSync } from "fs";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
    if (m) {
      process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
      break;
    }
  }
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
