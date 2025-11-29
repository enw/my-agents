import type { Config } from 'drizzle-kit';

export default {
  schema: '../../packages/infrastructure/src/persistence/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/agents.db',
  },
} satisfies Config;
