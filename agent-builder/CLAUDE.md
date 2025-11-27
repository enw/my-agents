# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Local Agent Builder & Runner** - A Next.js application for building, testing, and interacting with tool-using AI agents locally. Supports both local models (Ollama) and remote models (OpenRouter, OpenAI, Anthropic) with a unified interface.

## Architecture

This codebase strictly follows **Hexagonal Architecture (Ports & Adapters)** with clear dependency flow:

```
app/ (Next.js routes)
  ↓ calls
application/ (use cases)
  ↓ orchestrates
domain/ (business logic + ports)
  ↑ implemented by
infrastructure/ (adapters)
```

**Critical Rule**: Dependencies always point INWARD. Domain layer defines port interfaces; infrastructure implements them. Never import infrastructure code into domain.

### Core Layers

- **`domain/ports/`**: Interface definitions (ModelPort, ToolPort, AgentPort, TracePort, etc.)
- **`domain/entities/`**: Core business objects (Agent, ModelInfo, RunLog)
- **`domain/services/`**: Business logic services
- **`infrastructure/adapters/`**: External integrations (model providers, tools, database)
- **`infrastructure/config/bootstrap.ts`**: Dependency injection container
- **`application/use-cases/`**: Application orchestration layer
- **`app/`**: Next.js presentation layer (routes, components)

### Key Port Interfaces

All located in `domain/ports/index.ts`:

- **ModelPort**: LLM provider abstraction (`generate()`, `generateStream()`, `healthCheck()`)
- **ToolPort**: Tool registry and execution (`register()`, `execute()`, `listAll()`)
- **AgentPort**: Agent CRUD operations (`create()`, `findById()`, `update()`, `delete()`)
- **TracePort**: Execution logging (`createRun()`, `appendTurn()`, `logToolExecution()`)
- **ModelRegistryPort**: Model discovery (`listAllModels()`, `listByProvider()`)
- **StreamingPort**: Real-time response streaming (SSE)

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build
npm start

# Linting
npm run lint

# Database operations
npm run db:generate    # Generate migrations after schema changes
npm run db:push        # Apply migrations to database
npm run db:studio      # Open Drizzle Studio (database GUI)
```

## Database

- **ORM**: Drizzle with better-sqlite3
- **Schema**: `infrastructure/persistence/schema.ts`
- **Migrations**: `drizzle/` directory
- **Location**: `data/agents.db` (created automatically)

After modifying `schema.ts`:
```bash
npm run db:generate    # Creates migration files
npm run db:push        # Applies to database
```

## Dependency Injection

All dependencies are wired through `infrastructure/config/bootstrap.ts`:

- **DependencyContainer**: Lazy-initialized singleton for all ports and services
- **getContainer()**: Global accessor for Next.js API routes
- **bootstrapApplication()**: Initializes app, registers tools, refreshes models

Example usage in API routes:
```typescript
import { getContainer } from '@/infrastructure/config/bootstrap';

export async function GET() {
  const container = await getContainer();
  const agents = await container.agentPort.findMany({});
  return Response.json(agents);
}
```

## Adding New Components

### Adding a New Model Provider

1. Create adapter in `infrastructure/adapters/models/` implementing `ModelPort`
2. Update `ModelFactory` in bootstrap.ts to instantiate your adapter
3. Update `ModelRegistryService` to discover models from the provider
4. Add API key to `.env.local.example` and `.env.local`

### Adding a New Tool

1. Create tool in `infrastructure/adapters/tools/` implementing `Tool` interface
2. Register in `createDefaultTools()` function
3. Tool automatically appears in `/api/tools` endpoint
4. Agents opt-in via `allowedTools` array

Tool interface requirements:
```typescript
{
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  execute(params): Promise<ToolResult>;
  isAvailable?(): Promise<boolean>;
}
```

### Adding a New Use Case

1. Create in `application/use-cases/`
2. Inject required ports via constructor
3. Export from `UseCaseFactory` in bootstrap.ts
4. Access via `container.useCases.yourUseCase()`

## Security Constraints

- **Tool Sandboxing**: Shell tool runs in temp directory, file tool restricted to workspace
- **Per-Agent Allowlist**: Tools are opt-in via `allowedTools` array
- **Runtime Validation**: Tool access enforced at execution time
- **No Secret Leakage**: API keys never sent to client or logged

## TypeScript Paths

`tsconfig.json` defines `@/*` alias mapping to project root. Use for all imports:

```typescript
import { getContainer } from '@/infrastructure/config/bootstrap';
import { Agent } from '@/domain/entities/agent.entity';
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

```bash
# Required
DATABASE_PATH=./data/agents.db
WORKSPACE_DIR=./workspace

# Optional (for remote models)
OPENROUTER_API_KEY=sk-or-v1-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional (Ollama)
OLLAMA_BASE_URL=http://localhost:11434
```

## Common Patterns

### Creating a New API Route

```typescript
// app/api/your-route/route.ts
import { getContainer } from '@/infrastructure/config/bootstrap';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const container = await getContainer();
    const result = await container.useCases.yourUseCase();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### Error Handling

Domain errors are defined in `domain/ports/index.ts`:
- `ValidationError`: Invalid input data
- `NotFoundError`: Resource not found
- `ModelError`: LLM provider failures
- `ToolExecutionError`: Tool execution failures
- `UnauthorizedToolError`: Tool not allowed for agent

## Testing Local Models

Ensure Ollama is installed and running:

```bash
# Install Ollama from https://ollama.ai

# Pull models
ollama pull llama3.2
ollama pull codellama

# Verify Ollama is running
curl http://localhost:11434/api/tags

# Start dev server
npm run dev
```

Models auto-discovered at startup. Check logs for "Found X models".

## Project Structure Notes

- `app/components/`: UI components (not yet implemented)
- `workspace/`: Safe directory for file tool operations
- `.sandbox/`: Temporary directory for shell tool execution
- `drizzle/`: Generated migration files (do not manually edit)

## Path Aliases

All imports use `@/` prefix for project root:
- `@/domain/*` - Domain layer
- `@/infrastructure/*` - Infrastructure layer
- `@/application/*` - Application layer
- `@/app/*` - Presentation layer
