/**
 * Database Schema - Drizzle ORM
 *
 * This defines the SQLite schema for persistence.
 * Uses Drizzle ORM for type-safe database access.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// AGENTS TABLE
// ============================================================================

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  defaultModel: text('default_model').notNull(),
  allowedTools: text('allowed_tools').notNull(), // JSON array as string
  tags: text('tags').notNull(), // JSON array as string
  settings: text('settings').notNull().default('{}'), // JSON object: { temperature, maxTokens, topP }
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const agentsRelations = relations(agents, ({ many }) => ({
  runs: many(runs),
  promptVersions: many(promptVersions),
}));

// ============================================================================
// RUNS TABLE - Execution Logs
// ============================================================================

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  modelUsed: text('model_used').notNull(),
  status: text('status').notNull(), // 'running' | 'completed' | 'error'
  totalInputTokens: integer('total_input_tokens').notNull().default(0),
  totalOutputTokens: integer('total_output_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  totalToolCalls: integer('total_tool_calls').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  error: text('error'),
});

export const runsRelations = relations(runs, ({ one, many }) => ({
  agent: one(agents, {
    fields: [runs.agentId],
    references: [agents.id],
  }),
  turns: many(turns),
  toolExecutions: many(toolExecutions),
}));

// ============================================================================
// TURNS TABLE - Conversation Turns
// ============================================================================

export const turns = sqliteTable('turns', {
  id: text('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => runs.id, { onDelete: 'cascade' }),
  turnNumber: integer('turn_number').notNull(),
  userMessage: text('user_message').notNull(),
  assistantMessage: text('assistant_message').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

export const turnsRelations = relations(turns, ({ one, many }) => ({
  run: one(runs, {
    fields: [turns.runId],
    references: [runs.id],
  }),
  toolExecutions: many(toolExecutions),
}));

// ============================================================================
// TOOL EXECUTIONS TABLE
// ============================================================================

export const toolExecutions = sqliteTable('tool_executions', {
  id: text('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => runs.id, { onDelete: 'cascade' }),
  turnId: text('turn_id')
    .notNull()
    .references(() => turns.id, { onDelete: 'cascade' }),
  toolName: text('tool_name').notNull(),
  parameters: text('parameters').notNull(), // JSON object as string
  success: integer('success', { mode: 'boolean' }).notNull(),
  output: text('output').notNull(),
  data: text('data'), // JSON data as string
  error: text('error'),
  executionTimeMs: integer('execution_time_ms').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

export const toolExecutionsRelations = relations(toolExecutions, ({ one }) => ({
  run: one(runs, {
    fields: [toolExecutions.runId],
    references: [runs.id],
  }),
  turn: one(turns, {
    fields: [toolExecutions.turnId],
    references: [turns.id],
  }),
}));

// ============================================================================
// PROMPT VERSIONS TABLE - Version History for System Prompts
// ============================================================================

export const promptVersions = sqliteTable('prompt_versions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(), // Auto-incrementing version number per agent
  systemPrompt: text('system_prompt').notNull(),
  commitMessage: text('commit_message'), // Optional commit message
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const promptVersionsRelations = relations(promptVersions, ({ one }) => ({
  agent: one(agents, {
    fields: [promptVersions.agentId],
    references: [agents.id],
  }),
}));

// ============================================================================
// MODEL USAGE TABLE - Track Model Performance
// ============================================================================

export const modelUsage = sqliteTable('model_usage', {
  id: text('id').primaryKey(),
  modelId: text('model_id').notNull(),
  provider: text('provider').notNull(), // 'ollama' | 'openrouter' | etc
  latencyMs: integer('latency_ms').notNull(),
  tokensPerSecond: real('tokens_per_second'),
  qualityRating: integer('quality_rating'), // 1-5 (future feature)
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

// ============================================================================
// TYPE EXPORTS - For Use in Application Code
// ============================================================================

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;

export type Turn = typeof turns.$inferSelect;
export type NewTurn = typeof turns.$inferInsert;

export type ToolExecution = typeof toolExecutions.$inferSelect;
export type NewToolExecution = typeof toolExecutions.$inferInsert;

export type ModelUsage = typeof modelUsage.$inferSelect;
export type NewModelUsage = typeof modelUsage.$inferInsert;

export type PromptVersion = typeof promptVersions.$inferSelect;
export type NewPromptVersion = typeof promptVersions.$inferInsert;

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Sample data for development/testing
 */
export const sampleAgents: NewAgent[] = [
  {
    id: crypto.randomUUID(),
    name: 'Code Assistant',
    description: 'Helps with coding tasks, debugging, and code review',
    systemPrompt:
      'You are a helpful coding assistant. Help users write clean, efficient code and explain complex concepts clearly.',
    defaultModel: 'ollama:llama3.2',
    allowedTools: JSON.stringify(['file', 'code_exec', 'http']),
    tags: JSON.stringify(['coding', 'development']),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: crypto.randomUUID(),
    name: 'Research Assistant',
    description: 'Helps with research, summarization, and analysis',
    systemPrompt:
      'You are a research assistant. Help users find information, summarize documents, and analyze data.',
    defaultModel: 'ollama:llama3.2',
    allowedTools: JSON.stringify(['http', 'file']),
    tags: JSON.stringify(['research', 'analysis']),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: crypto.randomUUID(),
    name: 'DevOps Helper',
    description: 'Assists with deployment, monitoring, and system administration',
    systemPrompt:
      'You are a DevOps assistant. Help users with deployment, system administration, and infrastructure tasks.',
    defaultModel: 'ollama:llama3.2',
    allowedTools: JSON.stringify(['shell', 'file', 'http', 'ollama_info']),
    tags: JSON.stringify(['devops', 'infrastructure']),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ============================================================================
// INDEXES FOR QUERY PERFORMANCE
// ============================================================================

/**
 * Recommended indexes (create in migration):
 *
 * CREATE INDEX idx_runs_agent_id ON runs(agent_id);
 * CREATE INDEX idx_runs_status ON runs(status);
 * CREATE INDEX idx_runs_created_at ON runs(created_at);
 * CREATE INDEX idx_turns_run_id ON turns(run_id);
 * CREATE INDEX idx_tool_executions_run_id ON tool_executions(run_id);
 * CREATE INDEX idx_tool_executions_turn_id ON tool_executions(turn_id);
 * CREATE INDEX idx_tool_executions_tool_name ON tool_executions(tool_name);
 * CREATE INDEX idx_model_usage_model_id ON model_usage(model_id);
 * CREATE INDEX idx_model_usage_timestamp ON model_usage(timestamp);
 */

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Type-safe query builders for common operations
 */

import { eq, and, desc, asc, like, inArray, gte, lte, sql } from 'drizzle-orm';

export const queries = {
  // Agent queries
  findAgentById: (db: any, id: string) =>
    db.select().from(agents).where(eq(agents.id, id)).get(),

  findAgentsByTags: (db: any, tags: string[]) =>
    db
      .select()
      .from(agents)
      .where(
        sql`EXISTS (
        SELECT 1 FROM json_each(${agents.tags})
        WHERE value IN (${tags.join(',')})
      )`
      )
      .all(),

  searchAgents: (db: any, searchTerm: string) =>
    db
      .select()
      .from(agents)
      .where(
        sql`${agents.name} LIKE ${'%' + searchTerm + '%'} OR ${agents.description} LIKE ${'%' + searchTerm + '%'}`
      )
      .all(),

  // Run queries
  findRunsByAgent: (db: any, agentId: string, limit = 50) =>
    db
      .select()
      .from(runs)
      .where(eq(runs.agentId, agentId))
      .orderBy(desc(runs.createdAt))
      .limit(limit)
      .all(),

  findRunsWithTurns: (db: any, runId: string) =>
    db.query.runs.findFirst({
      where: eq(runs.id, runId),
      with: {
        turns: {
          orderBy: asc(turns.turnNumber),
          with: {
            toolExecutions: true,
          },
        },
      },
    }),

  // Tool statistics
  getToolStats: (db: any, agentId: string) =>
    db
      .select({
        toolName: toolExecutions.toolName,
        totalExecutions: sql<number>`COUNT(*)`,
        successfulExecutions: sql<number>`SUM(CASE WHEN ${toolExecutions.success} = 1 THEN 1 ELSE 0 END)`,
        successRate: sql<number>`CAST(SUM(CASE WHEN ${toolExecutions.success} = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100`,
        avgExecutionTime: sql<number>`AVG(${toolExecutions.executionTimeMs})`,
      })
      .from(toolExecutions)
      .innerJoin(runs, eq(toolExecutions.runId, runs.id))
      .where(eq(runs.agentId, agentId))
      .groupBy(toolExecutions.toolName)
      .all(),

  // Model performance
  getModelPerformance: (db: any, modelId: string, days = 30) =>
    db
      .select({
        avgLatency: sql<number>`AVG(${modelUsage.latencyMs})`,
        avgTokensPerSec: sql<number>`AVG(${modelUsage.tokensPerSecond})`,
        usageCount: sql<number>`COUNT(*)`,
      })
      .from(modelUsage)
      .where(
        and(
          eq(modelUsage.modelId, modelId),
          gte(
            modelUsage.timestamp,
            new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          )
        )
      )
      .get(),

  // Token usage over time
  getTokenUsageByDate: (db: any, agentId: string, days = 30) =>
    db
      .select({
        date: sql<string>`DATE(${runs.createdAt}, 'unixepoch')`,
        totalTokens: sql<number>`SUM(${runs.totalTokens})`,
        runCount: sql<number>`COUNT(*)`,
      })
      .from(runs)
      .where(
        and(
          eq(runs.agentId, agentId),
          gte(
            runs.createdAt,
            new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          )
        )
      )
      .groupBy(sql`DATE(${runs.createdAt}, 'unixepoch')`)
      .orderBy(sql`DATE(${runs.createdAt}, 'unixepoch')`)
      .all(),
};
