import type { Config } from 'drizzle-kit';

export default {
  schema: './infrastructure/persistence/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/agents.db',
  },
} satisfies Config;
