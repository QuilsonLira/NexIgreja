import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL?.trim();

export default defineConfig({
  out: "./drizzle-mysql",
  schema: "./db/schema.mysql.ts",
  dialect: "mysql",
  ...(databaseUrl
    ? {
        dbCredentials: {
          url: databaseUrl,
        },
      }
    : {}),
});
