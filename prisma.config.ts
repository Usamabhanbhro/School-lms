import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // The fallback URL exists only so `prisma generate` (postinstall/build) can
    // run before a real connection string is configured. Database commands
    // (migrate, db push, studio) require DATABASE_URL to be set.
    url: process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/school_lms",
  },
});
