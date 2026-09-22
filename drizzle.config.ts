import { defineConfig } from "drizzle-kit";

// drizzle-kit only GENERATES the SQL here; it never touches the database.
// Applying it is wrangler's job (`pnpm run db:migrate`), because D1 is reached
// through Cloudflare's API, not a Postgres-style connection string.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
