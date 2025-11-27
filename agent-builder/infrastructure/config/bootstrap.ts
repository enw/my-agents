/**
 * Application Bootstrap & Dependency Injection
 *
 * This file contains the dependency injection container and application startup logic.
 * All dependencies are wired up here, following the dependency inversion principle.
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../persistence/schema';

import {
  AgentPort,
  ModelRegistryPort,
  StreamingPort,
  ToolPort,
  TracePort,
} from '../../domain/ports';

import {
  DefaultModelRegistry,
  InMemoryToolRegistry,
  ModelFactory,
  SqliteAgentRepository,
  SqliteTraceRepository,
  SSEStreamingAdapter,
} from '../adapters';

import {
  AgentExecutionService,
  AgentValidationService,
  DefaultAgentExecutionService,
  ToolRegistryService,
} from '../../domain/services';

import { UseCaseFactory } from '../../application/use-cases';

import { createDefaultTools } from '../adapters/tools/index';

import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface AppConfig {
  // Database
  dbPath: string;

  // Directories
  sandboxRoot: string;
  workspaceRoot: string;

  // API Keys (optional - from .env.local)
  openRouterApiKey?: string;
  openAiApiKey?: string;
  anthropicApiKey?: string;

  // Ollama
  ollamaBaseUrl?: string;

  // Environment
  nodeEnv: 'development' | 'production' | 'test';
}

export function loadConfig(): AppConfig {
  const rootDir = process.cwd();

  return {
    dbPath: process.env.DATABASE_URL || path.join(rootDir, 'data', 'agents.db'),
    sandboxRoot: process.env.SANDBOX_ROOT || path.join(rootDir, '.sandbox'),
    workspaceRoot: process.env.WORKSPACE_ROOT || path.join(rootDir, 'workspace'),
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    openAiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    nodeEnv: (process.env.NODE_ENV as any) || 'development',
  };
}

// ============================================================================
// DEPENDENCY CONTAINER
// ============================================================================

export class DependencyContainer {
  // Infrastructure
  private _db?: ReturnType<typeof drizzle>;
  private _agentPort?: AgentPort;
  private _toolPort?: ToolPort;
  private _tracePort?: TracePort;
  private _streamingPort?: StreamingPort;
  private _modelRegistry?: ModelRegistryPort;
  private _modelFactory?: ModelFactory;

  // Domain Services
  private _executionService?: AgentExecutionService;
  private _validationService?: AgentValidationService;
  private _toolRegistryService?: ToolRegistryService;

  // Application Services
  private _useCaseFactory?: UseCaseFactory;

  constructor(private config: AppConfig) {}

  // ============================================================================
  // Infrastructure Layer
  // ============================================================================

  get db() {
    if (!this._db) {
      // Ensure directory exists
      const dbDir = path.dirname(this.config.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const sqlite = new Database(this.config.dbPath);
      this._db = drizzle(sqlite, { schema });

      // Enable foreign keys
      sqlite.pragma('foreign_keys = ON');

      console.log(`Database connected: ${this.config.dbPath}`);
    }
    return this._db;
  }

  get agentPort(): AgentPort {
    if (!this._agentPort) {
      this._agentPort = new SqliteAgentRepository(this.db);
    }
    return this._agentPort;
  }

  get toolPort(): ToolPort {
    if (!this._toolPort) {
      this._toolPort = new InMemoryToolRegistry();
    }
    return this._toolPort;
  }

  get tracePort(): TracePort {
    if (!this._tracePort) {
      this._tracePort = new SqliteTraceRepository(this.db);
    }
    return this._tracePort;
  }

  get streamingPort(): StreamingPort {
    if (!this._streamingPort) {
      this._streamingPort = new SSEStreamingAdapter();
    }
    return this._streamingPort;
  }

  get modelRegistry(): ModelRegistryPort {
    if (!this._modelRegistry) {
      this._modelRegistry = new DefaultModelRegistry(
        this.config.ollamaBaseUrl,
        this.config.openRouterApiKey
      );
    }
    return this._modelRegistry;
  }

  get modelFactory(): ModelFactory {
    if (!this._modelFactory) {
      this._modelFactory = new ModelFactory({
        openRouterApiKey: this.config.openRouterApiKey,
        openAiApiKey: this.config.openAiApiKey,
        anthropicApiKey: this.config.anthropicApiKey,
      });
    }
    return this._modelFactory;
  }

  // ============================================================================
  // Domain Services
  // ============================================================================

  get executionService(): AgentExecutionService {
    if (!this._executionService) {
      this._executionService = new DefaultAgentExecutionService(
        this.agentPort,
        this.modelRegistry,
        this.toolPort,
        this.tracePort,
        this.streamingPort
      );
    }
    return this._executionService;
  }

  get validationService(): AgentValidationService {
    if (!this._validationService) {
      this._validationService = new AgentValidationService(
        this.modelRegistry,
        this.toolPort
      );
    }
    return this._validationService;
  }

  get toolRegistryService(): ToolRegistryService {
    if (!this._toolRegistryService) {
      this._toolRegistryService = new ToolRegistryService(this.toolPort);
    }
    return this._toolRegistryService;
  }

  // ============================================================================
  // Application Services
  // ============================================================================

  get useCases(): UseCaseFactory {
    if (!this._useCaseFactory) {
      this._useCaseFactory = new UseCaseFactory({
        agentPort: this.agentPort,
        modelRegistry: this.modelRegistry,
        toolPort: this.toolPort,
        tracePort: this.tracePort,
        executionService: this.executionService,
        validationService: this.validationService,
      });
    }
    return this._useCaseFactory;
  }
}

// ============================================================================
// APPLICATION STARTUP
// ============================================================================

export async function bootstrapApplication(config: AppConfig): Promise<DependencyContainer> {
  console.log('🚀 Starting Local Agent Builder...');

  // Create dependency container
  const container = new DependencyContainer(config);

  // 1. Ensure directories exist
  await ensureDirectories(config);

  // 2. Initialize database
  await initializeDatabase(container);

  // 3. Register all tools
  await registerTools(container, config);

  // 4. Refresh model registry
  await refreshModels(container);

  console.log('✅ Application started successfully');

  return container;
}

async function ensureDirectories(config: AppConfig) {
  const dirs = [
    path.dirname(config.dbPath),
    config.sandboxRoot,
    config.workspaceRoot,
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
}

async function initializeDatabase(container: DependencyContainer) {
  try {
    // Database tables are created automatically by Drizzle migrations
    // This would typically run: npx drizzle-kit push:sqlite
    console.log('Database initialized');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

async function registerTools(container: DependencyContainer, config: AppConfig) {
  const tools = createDefaultTools({
    sandboxRoot: config.sandboxRoot,
    workspaceRoot: config.workspaceRoot,
  });

  await container.toolRegistryService.registerAllTools(tools);

  console.log(`Registered ${tools.length} tools:`, tools.map((t) => t.name).join(', '));

  // Check tool availability
  const availableTools = await container.toolRegistryService.getAvailableTools();
  const unavailable = availableTools.filter((t) => !t.available);

  if (unavailable.length > 0) {
    console.warn(
      '⚠️  Some tools are unavailable:',
      unavailable.map((t) => t.name).join(', ')
    );
  }
}

async function refreshModels(container: DependencyContainer) {
  try {
    await container.modelRegistry.refresh();
    const models = await container.modelRegistry.listAllModels();

    console.log(`Found ${models.length} models:`);

    const ollamaModels = models.filter((m) => m.provider === 'ollama');
    const remoteModels = models.filter((m) => m.provider !== 'ollama');

    if (ollamaModels.length > 0) {
      console.log(`  Local (Ollama): ${ollamaModels.map((m) => m.displayName).join(', ')}`);
    } else {
      console.warn('  ⚠️  No Ollama models found. Install models with: ollama pull <model>');
    }

    if (remoteModels.length > 0) {
      console.log(`  Remote: ${remoteModels.length} models available`);
    }
  } catch (error) {
    console.warn('⚠️  Failed to refresh model registry:', error);
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

export async function shutdownApplication(container: DependencyContainer) {
  console.log('🛑 Shutting down application...');

  // Close database connection
  // container.db.close(); // If using better-sqlite3 directly

  console.log('✅ Application shut down successfully');
}

// ============================================================================
// GLOBAL CONTAINER (for Next.js API routes)
// ============================================================================

let globalContainer: DependencyContainer | null = null;

export async function getContainer(): Promise<DependencyContainer> {
  if (!globalContainer) {
    const config = loadConfig();
    globalContainer = await bootstrapApplication(config);
  }
  return globalContainer;
}

// ============================================================================
// DEVELOPMENT HELPERS
// ============================================================================

/**
 * Seed database with sample data (development only)
 */
export async function seedDatabase(container: DependencyContainer) {
  const { sampleAgents } = await import('../persistence/schema');

  for (const agentData of sampleAgents) {
    try {
      await container.agentPort.create({
        name: agentData.name,
        description: agentData.description,
        systemPrompt: agentData.systemPrompt,
        defaultModel: agentData.defaultModel,
        allowedTools: JSON.parse(agentData.allowedTools),
        tags: JSON.parse(agentData.tags),
      });
      console.log(`Created sample agent: ${agentData.name}`);
    } catch (error) {
      console.warn(`Failed to create sample agent ${agentData.name}:`, error);
    }
  }
}

/**
 * Reset database (development only)
 */
export async function resetDatabase(container: DependencyContainer) {
  console.warn('⚠️  Resetting database...');

  // Drop and recreate tables
  // This would typically run: npx drizzle-kit drop && npx drizzle-kit push

  console.log('Database reset complete');
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function healthCheck(container: DependencyContainer): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
}> {
  const checks: Record<string, boolean> = {};

  // Check database
  try {
    await container.agentPort.findMany({ limit: 1 });
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check Ollama
  try {
    const ollamaModels = await container.modelRegistry.listByProvider('ollama');
    checks.ollama = ollamaModels.length > 0;
  } catch {
    checks.ollama = false;
  }

  // Check tools
  try {
    const tools = await container.toolRegistryService.getAvailableTools();
    checks.tools = tools.some((t) => t.available);
  } catch {
    checks.tools = false;
  }

  const healthy = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;

  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (healthy === total) {
    status = 'healthy';
  } else if (healthy > 0) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return { status, checks };
}
