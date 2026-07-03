import { PrismaClient } from "@prisma/client";

import { hasDatabase } from "@/lib/env";

/**
 * Lazy, build-safe Prisma singleton.
 *
 * Prisma 7 uses the "client" query engine which requires a driver adapter
 * (e.g. `@prisma/adapter-pg`) to be passed to the `PrismaClient` constructor.
 * Constructing the client at module-load time therefore throws when no adapter
 * / database is configured — which crashes Next.js "collect page data" during
 * `next build` and any render that merely imports this module.
 *
 * To keep the app buildable and renderable WITHOUT a live database, we expose
 * `prisma` as a Proxy that only instantiates the real client on first property
 * access. When no database is configured (or the adapter package is missing),
 * accessing the client throws a descriptive error at *query time* only — every
 * data fetch in the app is wrapped in try/catch and degrades to mock/empty
 * data, so pages still render.
 *
 * To enable real database access:
 *   1. `npm i @prisma/adapter-pg pg`
 *   2. Set DATABASE_URL / DIRECT_URL
 *   3. Uncomment the adapter block in `createClient()` below.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  if (!hasDatabase) {
    throw new Error(
      "DATABASE_URL is not configured — running in mock mode. " +
        "Set DATABASE_URL and a Prisma driver adapter to enable real database access.",
    );
  }

  // --- Real Postgres access (requires `@prisma/adapter-pg` + `pg`) ----------
  // const { PrismaPg } = await import("@prisma/adapter-pg");
  // const adapter = new PrismaPg({ connectionString: env.DATABASE_URL! });
  // return new PrismaClient({ adapter, log: ["error"] });
  // --------------------------------------------------------------------------

  throw new Error(
    "No Prisma driver adapter is installed. Install `@prisma/adapter-pg` (and `pg`) " +
      "and enable the adapter block in lib/prisma.ts to connect to Postgres. " +
      "The app runs in mock mode until then.",
  );
}

let cached: PrismaClient | undefined = globalForPrisma.prisma;

function getClient(): PrismaClient {
  if (!cached) {
    cached = createClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = cached;
    }
  }
  return cached;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
