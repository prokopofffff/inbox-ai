import "dotenv/config"
import path from "node:path"
import { defineConfig } from "@prisma/config"

// Prisma 7 configuration. Connection URLs live here (they are no longer allowed
// in the datasource block of schema.prisma). `url` maps to env("DATABASE_URL")
// and `shadowDatabaseUrl` (the direct/migration connection) maps to
// env("DIRECT_URL").
//
// We read process.env directly (rather than @prisma/config's `env()` helper)
// with a harmless localhost placeholder so that schema-only commands like
// `prisma validate` and `prisma generate` still work when no .env is present —
// this keeps the app renderable locally without real credentials. Commands that
// actually touch the database (db push, migrate, seed) require a real
// DATABASE_URL / DIRECT_URL to be set.
const PLACEHOLDER_URL =
  "postgresql://postgres:postgres@localhost:5432/inbox_ai?schema=public"

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL ?? PLACEHOLDER_URL,
    shadowDatabaseUrl:
      process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? PLACEHOLDER_URL,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
})
