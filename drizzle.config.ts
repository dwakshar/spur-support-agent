import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// drizzle-kit doesn't read .env.local (Next.js convention) — load it explicitly
config({ path: ".env.local" });
config({ path: ".env" }); // fallback for plain .env

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
