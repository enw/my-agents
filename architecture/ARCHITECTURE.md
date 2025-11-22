# Technical Architecture Document
## Local Agent Builder & Runner

**Version:** 1.0
**Last Updated:** 2025-11-22

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Principles](#core-principles)
3. [Module Structure](#module-structure)
4. [Data Flow](#data-flow)
5. [Port Interfaces](#port-interfaces)
6. [Adapter Implementations](#adapter-implementations)
7. [Domain Services](#domain-services)
8. [Use Cases](#use-cases)
9. [Database Schema](#database-schema)
10. [Testing Strategy](#testing-strategy)
11. [Error Handling](#error-handling)
12. [Security Model](#security-model)
13. [Extension Points](#extension-points)
14. [Performance Considerations](#performance-considerations)

---

## Architecture Overview

### High-Level Structure

The application follows **Hexagonal Architecture (Ports & Adapters)** pattern with strict dependency inversion:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  Next.js UI, API Routes, Server Actions, SSE Endpoints      │
└────────────────┬────────────────────────────────────────────┘
                 │ (uses)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│   Use Cases: CreateAgent, ExecuteAgent, ListModels, etc.    │
└────────────────┬────────────────────────────────────────────┘
                 │ (orchestrates)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                            │
│  Business Logic: AgentExecutionService, ValidationService   │
│  Entities: Agent, Run, Turn, ToolExecution                  │
│  Ports: ModelPort, AgentPort, ToolPort, TracePort           │
└────────────────┬────────────────────────────────────────────┘
                 │ (depends on)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                       │
│  Adapters: OllamaAdapter, OpenRouterAdapter, SQLiteRepo    │
│  Tools: ShellTool, FileTool, HttpTool, CodeExecTool        │
│  External Systems: SQLite, Ollama, OpenRouter APIs          │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **Hexagonal Architecture** | Loose coupling, testability, easy to swap implementations | More initial boilerplate, learning curve |
| **Ports & Adapters** | Can swap Ollama for OpenAI without touching domain logic | Requires interface discipline |
| **SQLite with Drizzle** | Simple, file-based, type-safe, no external DB server | Not suitable for high concurrency (fine for local use) |
| **In-Memory Tool Registry** | Fast, no persistence needed, tools self-register | Tools re-register on restart (acceptable) |
| **SSE for Streaming** | Simple, native browser support, one-way communication | Not bidirectional (fine for our use case) |
| **Next.js App Router** | Modern, RSC support, server actions, file-based routing | Newer API, some patterns still emerging |

---

## Core Principles

### 1. Dependency Inversion
- **All dependencies point inward to the domain**
- Domain layer defines ports (interfaces)
- Infrastructure layer implements adapters
- Application layer orchestrates via use cases

```typescript
// ✅ CORRECT: Domain depends on abstractions
class AgentExecutionService {
  constructor(
    private modelPort: ModelPort,  // Interface, not concrete class
    private toolPort: ToolPort
  ) {}
}

// ❌ WRONG: Domain depends on concrete implementation
class AgentExecutionService {
  constructor(
    private ollamaAdapter: OllamaModelAdapter  // Concrete class
  ) {}
}
```

### 2. Single Responsibility
Each module has ONE reason to change:

- **ModelPort**: How we interact with LLMs (interface contract)
- **OllamaAdapter**: How we connect to Ollama specifically
- **AgentExecutionService**: How we execute the agent loop
- **ExecuteAgentUseCase**: Entry point for agent execution

### 3. Open/Closed Principle
- **Open for extension**: Add new model providers without modifying existing code
- **Closed for modification**: Core domain logic doesn't change when adding providers

```typescript
// Adding a new provider:
class AnthropicAdapter implements ModelPort {
  // Implement interface - no changes to domain layer
}
```

### 4. Interface Segregation
Ports are focused on specific capabilities:

- **ModelPort**: Generate text, stream responses, health checks
- **ToolPort**: Register, execute, validate tools
- **AgentPort**: CRUD operations for agents
- **TracePort**: Logging and observability

### 5. Explicit Dependencies
All dependencies declared in constructor, never hidden:

```typescript
// ✅ Dependencies explicit and injectable
class UseCase {
  constructor(
    private agentPort: AgentPort,
    private modelRegistry: ModelRegistryPort
  ) {}
}

// ❌ Hidden dependency
class UseCase {
  execute() {
    const agent = await fetch('/api/agents/1'); // Hidden dependency
  }
}
```

---

## Module Structure

### Directory Layout

```
src/
├── domain/
│   ├── ports.ts                 # Port interfaces
│   ├── entities.ts              # Domain entities (Agent, Run, etc.)
│   ├── services/
│   │   ├── agent-execution.ts   # Core execution logic
│   │   ├── validation.ts        # Business rule validation
│   │   └── tool-registry.ts     # Tool discovery
│   └── errors.ts                # Domain-specific errors
│
├── application/
│   ├── use-cases/
│   │   ├── agents/              # Agent management use cases
│   │   ├── execution/           # Execution use cases
│   │   ├── models/              # Model discovery use cases
│   │   └── tools/               # Tool management use cases
│   └── factory.ts               # Use case factory (DI)
│
├── infrastructure/
│   ├── adapters/
│   │   ├── models/
│   │   │   ├── ollama.ts        # Ollama adapter
│   │   │   ├── openrouter.ts   # OpenRouter adapter
│   │   │   ├── openai.ts        # OpenAI adapter
│   │   │   └── factory.ts       # Model factory
│   │   ├── persistence/
│   │   │   ├── sqlite-agent-repo.ts
│   │   │   ├── sqlite-trace-repo.ts
│   │   │   └── schema.ts        # Drizzle schema
│   │   ├── streaming/
│   │   │   └── sse-adapter.ts   # SSE streaming
│   │   └── tools/
│   │       ├── shell-tool.ts
│   │       ├── file-tool.ts
│   │       ├── http-tool.ts
│   │       ├── code-exec-tool.ts
│   │       └── registry.ts
│   └── config/
│       └── bootstrap.ts         # DI container & startup
│
└── presentation/
    ├── app/                     # Next.js app router
    │   ├── api/
    │   │   ├── agents/          # Agent CRUD endpoints
    │   │   ├── run/             # Execution endpoint
    │   │   ├── models/          # Model discovery
    │   │   ├── tools/           # Tool listing
    │   │   └── stream/          # SSE streaming
    │   ├── agents/              # UI pages
    │   └── layout.tsx
    └── components/              # React components
        ├── agent-list.tsx
        ├── chat-interface.tsx
        ├── execution-log.tsx
        └── model-selector.tsx
```

### Dependency Graph

```
Presentation Layer (API Routes, UI)
    ↓ depends on
Application Layer (Use Cases)
    ↓ depends on
Domain Layer (Services, Ports)
    ↑ implemented by
Infrastructure Layer (Adapters)
```

**Key Rule**: Dependencies only flow downward, never upward.

---

## Data Flow

### Agent Execution Flow (with Tool Calling)

```
1. User Request (Presentation)
   POST /api/run { agentId, message }
   ↓
2. Use Case (Application)
   ExecuteAgentUseCase.execute(agentId, message)
   ↓
3. Domain Service (Domain)
   AgentExecutionService.executeAgentLoop()
   ↓
4. Load Agent Config
   AgentPort.findById(agentId) → Agent
   ↓
5. Get Model Adapter
   ModelFactory.create(modelId) → ModelPort
   ↓
6. Execute Agent Loop (ReAct Pattern):

   ┌─────────────────────────────────────┐
   │ LOOP (max 10 turns)                 │
   ├─────────────────────────────────────┤
   │                                     │
   │  a. Call LLM                        │
   │     ModelPort.generate()            │
   │     → GenerateResponse              │
   │                                     │
   │  b. If tool_calls in response:      │
   │     - Validate tool allowed         │
   │     - ToolPort.execute(tool, params)│
   │     - Log execution (TracePort)     │
   │     - Add result to messages        │
   │     - Continue loop                 │
   │                                     │
   │  c. Else:                           │
   │     - Return final response         │
   │     - Break loop                    │
   │                                     │
   └─────────────────────────────────────┘
   ↓
7. Log Turn
   TracePort.appendTurn(runId, turn)
   ↓
8. Return Response (Presentation)
   { runId, status: 'completed' }
```

### Streaming Flow

```
1. User Request
   POST /api/run { agentId, message, stream: true }
   ↓
2. Create Stream Session
   StreamingPort.createSession() → sessionId
   ↓
3. Return Session ID Immediately
   { streamSessionId }
   ↓
4. Client Connects to SSE
   GET /api/stream/:sessionId
   ↓
5. Execute Agent (Background)
   For each token from ModelPort.generateStream():
     StreamingPort.send(sessionId, chunk)
   ↓
6. Client Receives Events
   data: {"type":"content","content":"Hello"}
   data: {"type":"tool_call","toolCall":{...}}
   data: {"type":"done"}
```

### Model Discovery Flow

```
1. Application Startup
   bootstrapApplication()
   ↓
2. Refresh Model Registry
   ModelRegistryPort.refresh()
   ↓
3. Fetch Ollama Models
   GET http://localhost:11434/api/tags
   → Parse and store as ModelInfo[]
   ↓
4. Fetch Remote Models (if API key configured)
   GET https://openrouter.ai/api/v1/models
   → Parse and store as ModelInfo[]
   ↓
5. Cache in Memory
   Map<modelId, ModelInfo>
   ↓
6. API Request
   GET /api/models
   → Return all ModelInfo[]
```

---

## Port Interfaces

### ModelPort - LLM Provider Abstraction

```typescript
interface ModelPort {
  // Core generation
  generate(request: GenerateRequest): Promise<GenerateResponse>;
  generateStream(request: GenerateRequest): AsyncGenerator<StreamChunk>;

  // Health & capabilities
  healthCheck(): Promise<HealthStatus>;
  getCapabilities(): ModelCapabilities;
}
```

**Key Design Decisions:**
- **Unified interface** for all providers (Ollama, OpenRouter, OpenAI, Anthropic)
- **Tool calling standardized** - all providers translate to same format
- **Streaming via AsyncGenerator** - natural async iteration
- **Health checks** - fail fast if model unavailable

### AgentPort - Agent Configuration Management

```typescript
interface AgentPort {
  create(data: CreateAgentData): Promise<Agent>;
  findById(id: string): Promise<Agent | null>;
  findMany(criteria: AgentQueryCriteria): Promise<Agent[]>;
  update(id: string, data: UpdateAgentData): Promise<Agent>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
```

**Key Design Decisions:**
- **Standard CRUD interface** - familiar pattern
- **Query criteria object** - extensible filtering
- **Null return for not found** - avoid throwing in queries
- **Throws for mutations** - explicit error handling for create/update/delete

### ToolPort - Tool Registry & Execution

```typescript
interface ToolPort {
  register(tool: Tool): void;
  get(name: string): Tool | null;
  listAll(): Tool[];
  listByNames(names: string[]): Tool[];
  execute(name: string, parameters: Record<string, unknown>): Promise<ToolResult>;
  validateParameters(name: string, parameters: Record<string, unknown>): void;
}
```

**Key Design Decisions:**
- **Self-registration** - tools register themselves at startup
- **In-memory registry** - no persistence needed (tools are code)
- **Parameter validation** - JSON schema validation
- **Execution sandboxing** - enforced by tool implementations

### TracePort - Execution Logging

```typescript
interface TracePort {
  createRun(data: CreateRunData): Promise<Run>;
  appendTurn(runId: string, turn: Turn): Promise<void>;
  logToolExecution(runId: string, execution: ToolExecution): Promise<void>;
  updateRunStatus(runId: string, status: RunStatus, error?: string): Promise<void>;
  getRun(runId: string): Promise<Run | null>;
  queryRuns(criteria: RunQueryCriteria): Promise<Run[]>;
  getToolStats(agentId: string): Promise<ToolStats[]>;
}
```

**Key Design Decisions:**
- **Append-only logging** - immutable audit trail
- **Structured traces** - Run → Turns → ToolExecutions hierarchy
- **Statistics support** - built-in aggregations for analytics
- **Query flexibility** - filter by agent, status, date range

---

## Adapter Implementations

### Model Adapters

#### OllamaModelAdapter

```typescript
class OllamaModelAdapter implements ModelPort {
  private baseUrl = 'http://localhost:11434';
  private modelName: string;

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // 1. Convert domain format to Ollama format
    const ollamaRequest = this.convertToOllamaFormat(request);

    // 2. HTTP POST to /api/chat
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({
        model: this.modelName,
        messages: ollamaRequest.messages,
        tools: ollamaRequest.tools,
      }),
    });

    // 3. Parse response and convert back to domain format
    const data = await response.json();
    return this.convertFromOllamaFormat(data);
  }
}
```

**Translation Layer:**
- Domain `GenerateRequest` → Ollama JSON format
- Ollama response → Domain `GenerateResponse`
- Tool calls: Ollama format → standardized format

#### OpenRouterModelAdapter

Similar structure, but translates to OpenRouter's API format. Key difference:

```typescript
// OpenRouter uses OpenAI-compatible format
headers: {
  'Authorization': `Bearer ${this.apiKey}`,
  'HTTP-Referer': 'http://localhost:3000',
  'X-Title': 'Local Agent Builder',
}
```

### Persistence Adapters

#### SqliteAgentRepository

```typescript
class SqliteAgentRepository implements AgentPort {
  constructor(private db: DrizzleDB) {}

  async findById(id: string): Promise<Agent | null> {
    const result = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, id))
      .get();

    if (!result) return null;

    // Deserialize JSON fields
    return {
      ...result,
      allowedTools: JSON.parse(result.allowedTools),
      tags: JSON.parse(result.tags),
    };
  }
}
```

**Key Responsibilities:**
- Translate domain entities ↔ database rows
- Deserialize JSON columns (allowedTools, tags)
- Handle Drizzle ORM queries
- Map database errors to domain errors

### Tool Adapters

#### ShellTool

```typescript
class ShellTool implements Tool {
  private sandboxRoot: string;

  async execute(parameters: Record<string, unknown>): Promise<ToolResult> {
    const command = parameters.command as string;
    const cwd = this.resolveSandboxPath(parameters.workingDir);

    // Security check: prevent directory traversal
    if (!cwd.startsWith(this.sandboxRoot)) {
      return { success: false, error: 'Security violation' };
    }

    // Execute with timeout
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });

    return { success: true, output: stdout };
  }
}
```

**Security Measures:**
- Sandboxed to temp directory
- Path traversal prevention
- Timeout enforcement (10s)
- Output size limits (1MB)

---

## Domain Services

### AgentExecutionService

**Responsibility**: Core agent execution logic (ReAct loop)

```typescript
class DefaultAgentExecutionService {
  async executeAgentLoop(
    agent: Agent,
    runId: string,
    userMessage: string,
    modelId: string
  ): Promise<void> {
    const model = this.getModelAdapter(modelId);
    const tools = this.toolPort.listByNames(agent.allowedTools);
    const messages: Message[] = [{ role: 'user', content: userMessage }];

    for (let turn = 1; turn <= maxTurns; turn++) {
      // 1. Call LLM
      const response = await model.generate({
        systemPrompt: agent.systemPrompt,
        messages,
        tools: tools.map(t => t.definition),
      });

      messages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
      });

      // 2. Execute tools if requested
      if (response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          // Security check
          if (!agent.allowedTools.includes(toolCall.name)) {
            throw new UnauthorizedToolError(toolCall.name, agent.id);
          }

          // Execute
          const result = await this.toolPort.execute(
            toolCall.name,
            toolCall.parameters
          );

          // Log
          await this.tracePort.logToolExecution(runId, {
            id: toolCall.id,
            toolName: toolCall.name,
            parameters: toolCall.parameters,
            result,
          });

          // Add to conversation
          messages.push({
            role: 'tool',
            content: result.output,
            toolCallId: toolCall.id,
          });
        }
        // Continue loop to get final response
      } else {
        // No tools, we're done
        break;
      }

      // 3. Log turn
      await this.tracePort.appendTurn(runId, {
        turnNumber: turn,
        userMessage: turn === 1 ? userMessage : '[Tool results]',
        assistantMessage: response.content,
        usage: response.usage,
      });
    }
  }
}
```

**Key Features:**
- **ReAct pattern**: Reason (LLM call) → Act (tool execution) → Observe (add result)
- **Security enforcement**: Validates tool allowed before execution
- **Comprehensive logging**: Every turn and tool execution logged
- **Loop protection**: Max turns limit (default 10)

### AgentValidationService

**Responsibility**: Business rule validation

```typescript
class AgentValidationService {
  async validate(data: CreateAgentData): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Name validation
    if (!data.name || data.name.trim().length === 0) {
      errors.push(new ValidationError('Name is required', 'name'));
    }

    // Model exists
    const modelInfo = await this.modelRegistry.getModelInfo(data.defaultModel);
    if (!modelInfo) {
      errors.push(new ValidationError('Model not found', 'defaultModel'));
    }

    // Tools exist
    for (const toolName of data.allowedTools) {
      const tool = this.toolPort.get(toolName);
      if (!tool) {
        errors.push(new ValidationError(`Tool ${toolName} not found`, 'allowedTools'));
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
```

---

## Use Cases

### CreateAgentUseCase

```typescript
class CreateAgentUseCase {
  constructor(
    private agentPort: AgentPort,
    private validationService: AgentValidationService
  ) {}

  async execute(data: CreateAgentData): Promise<Agent> {
    // 1. Validate
    const validation = await this.validationService.validate(data);
    if (!validation.valid) {
      throw validation.errors[0];
    }

    // 2. Create
    return await this.agentPort.create(data);
  }
}
```

### ExecuteAgentUseCase

```typescript
class ExecuteAgentUseCase {
  constructor(private executionService: AgentExecutionService) {}

  async execute(request: {
    agentId: string;
    message: string;
    modelOverride?: string;
  }): Promise<string> {
    return await this.executionService.execute(
      request.agentId,
      request.message,
      { modelOverride: request.modelOverride }
    );
  }
}
```

**Pattern**: Use cases are thin wrappers that:
1. Validate inputs
2. Call domain services
3. Handle cross-cutting concerns (transactions, authorization)
4. Return results

---

## Database Schema

### Tables

```sql
-- Agents
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  default_model TEXT NOT NULL,
  allowed_tools TEXT NOT NULL,  -- JSON array
  tags TEXT NOT NULL,            -- JSON array
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Runs
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  model_used TEXT NOT NULL,
  status TEXT NOT NULL,          -- 'running' | 'completed' | 'error'
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_tool_calls INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  error TEXT
);

-- Turns
CREATE TABLE turns (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  timestamp INTEGER NOT NULL
);

-- Tool Executions
CREATE TABLE tool_executions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  parameters TEXT NOT NULL,      -- JSON object
  success INTEGER NOT NULL,       -- boolean
  output TEXT NOT NULL,
  data TEXT,                      -- JSON data
  error TEXT,
  execution_time_ms INTEGER NOT NULL,
  timestamp INTEGER NOT NULL
);

-- Model Usage (for analytics)
CREATE TABLE model_usage (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  tokens_per_second REAL,
  quality_rating INTEGER,        -- 1-5 (future)
  timestamp INTEGER NOT NULL
);
```

### Indexes

```sql
CREATE INDEX idx_runs_agent_id ON runs(agent_id);
CREATE INDEX idx_runs_status ON runs(status);
CREATE INDEX idx_runs_created_at ON runs(created_at);
CREATE INDEX idx_turns_run_id ON turns(run_id);
CREATE INDEX idx_tool_executions_run_id ON tool_executions(run_id);
CREATE INDEX idx_tool_executions_tool_name ON tool_executions(tool_name);
CREATE INDEX idx_model_usage_model_id ON model_usage(model_id);
```

---

## Testing Strategy

### Unit Tests (Domain Layer)

```typescript
describe('AgentExecutionService', () => {
  let service: AgentExecutionService;
  let mockModelPort: jest.Mocked<ModelPort>;
  let mockToolPort: jest.Mocked<ToolPort>;
  let mockTracePort: jest.Mocked<TracePort>;

  beforeEach(() => {
    mockModelPort = createMockModelPort();
    mockToolPort = createMockToolPort();
    mockTracePort = createMockTracePort();

    service = new DefaultAgentExecutionService(
      mockAgentPort,
      mockModelRegistry,
      mockToolPort,
      mockTracePort,
      mockStreamingPort
    );
  });

  it('should execute agent without tool calls', async () => {
    // Arrange
    mockModelPort.generate.mockResolvedValue({
      content: 'Hello!',
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    // Act
    await service.execute('agent-1', 'Hello');

    // Assert
    expect(mockModelPort.generate).toHaveBeenCalledTimes(1);
    expect(mockToolPort.execute).not.toHaveBeenCalled();
  });

  it('should validate tool authorization', async () => {
    // Arrange
    mockModelPort.generate.mockResolvedValue({
      content: '',
      toolCalls: [{ id: '1', name: 'unauthorized_tool', parameters: {} }],
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    // Act & Assert
    await expect(
      service.execute('agent-1', 'Use tool')
    ).rejects.toThrow(UnauthorizedToolError);
  });
});
```

### Integration Tests (Adapters)

```typescript
describe('OllamaModelAdapter', () => {
  let adapter: OllamaModelAdapter;

  beforeEach(() => {
    adapter = new OllamaModelAdapter('llama3.2');
  });

  it('should generate response', async () => {
    const response = await adapter.generate({
      systemPrompt: 'You are a helpful assistant',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(response.content).toBeTruthy();
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  });

  it('should handle tool calls', async () => {
    const response = await adapter.generate({
      systemPrompt: 'You can use tools',
      messages: [{ role: 'user', content: 'Get weather' }],
      tools: [weatherToolDefinition],
    });

    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls[0].name).toBe('get_weather');
  });
});
```

### E2E Tests (Use Cases)

```typescript
describe('Agent Execution E2E', () => {
  let container: DependencyContainer;

  beforeAll(async () => {
    container = await bootstrapApplication(testConfig);
  });

  it('should execute agent end-to-end', async () => {
    // Create agent
    const createUseCase = container.useCases.createAgent();
    const agent = await createUseCase.execute({
      name: 'Test Agent',
      description: 'Test',
      systemPrompt: 'You are helpful',
      defaultModel: 'ollama:llama3.2',
      allowedTools: ['http'],
    });

    // Execute agent
    const executeUseCase = container.useCases.executeAgent();
    const runId = await executeUseCase.execute({
      agentId: agent.id,
      message: 'Fetch https://api.example.com/data',
    });

    // Verify run
    const getRunUseCase = container.useCases.getRun();
    const run = await getRunUseCase.execute(runId);

    expect(run.status).toBe('completed');
    expect(run.totalToolCalls).toBeGreaterThan(0);
  });
});
```

### Testing Boundaries

```
Unit Tests:
  ✅ Domain services (pure business logic)
  ✅ Validation logic
  ✅ Tool implementations (with mocks for external deps)

Integration Tests:
  ✅ Adapters with real external systems
  ✅ Database repositories
  ✅ Model adapters (if Ollama/API available)

E2E Tests:
  ✅ Full user flows via use cases
  ✅ API routes (Next.js route handlers)
  ✅ UI interactions (Playwright/Cypress)
```

---

## Error Handling

### Error Hierarchy

```typescript
// Base domain error
class DomainError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

// Specific errors
class ValidationError extends DomainError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND');
  }
}

class ModelError extends DomainError {
  constructor(message: string, public provider: string) {
    super(message, 'MODEL_ERROR');
  }
}

class UnauthorizedToolError extends DomainError {
  constructor(toolName: string, agentId: string) {
    super(
      `Tool ${toolName} is not allowed for agent ${agentId}`,
      'UNAUTHORIZED_TOOL'
    );
  }
}
```

### Error Handling Strategy

```typescript
// 1. Tools NEVER throw - return error in ToolResult
async execute(params): Promise<ToolResult> {
  try {
    const result = await performOperation();
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 2. Adapters translate external errors to domain errors
async generate(request): Promise<GenerateResponse> {
  try {
    const response = await fetch(...);
    return this.parseResponse(response);
  } catch (error) {
    throw new ModelError(`Ollama error: ${error.message}`, 'ollama');
  }
}

// 3. Use cases catch and handle domain errors
async execute(data): Promise<Agent> {
  try {
    const validation = await this.validate(data);
    if (!validation.valid) {
      throw validation.errors[0];
    }
    return await this.agentPort.create(data);
  } catch (error) {
    if (error instanceof ValidationError) {
      // Return user-friendly error
      throw new HttpError(400, error.message, { field: error.field });
    }
    // Log and return generic error
    logger.error('Failed to create agent', error);
    throw new HttpError(500, 'Internal server error');
  }
}
```

### API Error Responses

```typescript
// Standardized error format
interface ApiError {
  error: {
    code: string;
    message: string;
    field?: string;
    details?: unknown;
  };
}

// Examples:
// 400 Bad Request
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Name is required",
    "field": "name"
  }
}

// 404 Not Found
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Agent with id abc123 not found"
  }
}

// 500 Internal Server Error
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

---

## Security Model

### Tool Authorization

```typescript
// Per-agent allowlist
agent.allowedTools = ['file', 'http'];

// Runtime check in execution service
if (!agent.allowedTools.includes(toolCall.name)) {
  throw new UnauthorizedToolError(toolCall.name, agent.id);
}
```

### Tool Sandboxing

#### Shell Tool
- Executes in temp directory only (`/tmp/agent-sandbox/`)
- Path traversal prevention
- Timeout enforcement (10s)
- Output size limits (1MB)

```typescript
// Security check
if (!cwd.startsWith(this.sandboxRoot)) {
  return { success: false, error: 'Security violation' };
}
```

#### File Tool
- Restricted to workspace directory
- Path traversal prevention
- No system file access

```typescript
// Security check
const absolutePath = path.join(this.workspaceRoot, filePath);
if (!absolutePath.startsWith(this.workspaceRoot)) {
  return { success: false, error: 'Access denied' };
}
```

#### HTTP Tool
- Protocol whitelist (http, https only)
- Response size limits (5MB)
- Timeout enforcement (30s)
- No credential exposure in logs

### API Key Management

```env
# .env.local (never committed)
OPENROUTER_API_KEY=sk-or-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

- API keys in environment variables only
- Never logged or exposed in responses
- Loaded at startup via bootstrap

### Data Privacy

- Local-first: Agent prompts and conversation data stay local
- No telemetry or remote logging
- Remote model usage is explicit (user chooses OpenRouter vs Ollama)

---

## Extension Points

### Adding a New Model Provider

1. **Create Adapter** (Infrastructure)

```typescript
// infrastructure/adapters/models/anthropic.ts
export class AnthropicModelAdapter implements ModelPort {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // Implement Anthropic Messages API
  }

  getCapabilities(): ModelCapabilities {
    return {
      maxContextWindow: 200000,
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: true,
    };
  }
}
```

2. **Update Factory** (Infrastructure)

```typescript
// infrastructure/adapters/models/factory.ts
create(modelId: string): ModelPort {
  const [provider, modelName] = modelId.split(':');

  switch (provider) {
    case 'ollama':
      return new OllamaModelAdapter(modelName);
    case 'openrouter':
      return new OpenRouterModelAdapter(modelName, this.config.openRouterApiKey);
    case 'anthropic':  // ← Add here
      return new AnthropicModelAdapter(modelName, this.config.anthropicApiKey);
    default:
      throw new ModelError(`Unknown provider: ${provider}`, provider);
  }
}
```

3. **Update Model Registry** (Infrastructure)

```typescript
// infrastructure/adapters/model-registry.ts
async refresh(): Promise<void> {
  await this.refreshOllamaModels();
  await this.refreshOpenRouterModels();
  await this.refreshAnthropicModels();  // ← Add here
}

private async refreshAnthropicModels(): Promise<void> {
  // Fetch from Anthropic API
  const models = ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'];

  for (const model of models) {
    this.models.set(`anthropic:${model}`, {
      id: `anthropic:${model}`,
      provider: 'anthropic',
      displayName: model,
      contextWindow: 200000,
      supportsTools: true,
      supportsStreaming: true,
    });
  }
}
```

**No changes needed to:**
- Domain layer (AgentExecutionService)
- Application layer (Use cases)
- Presentation layer (API routes)

### Adding a New Tool

1. **Implement Tool Interface** (Infrastructure)

```typescript
// infrastructure/adapters/tools/search-tool.ts
export class SearchTool implements Tool {
  name = 'web_search';
  description = 'Search the web for information';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
        required: true,
      },
    },
    required: ['query'],
  };

  async execute(parameters: Record<string, unknown>): Promise<ToolResult> {
    const query = parameters.query as string;

    try {
      const results = await this.performSearch(query);
      return {
        success: true,
        output: this.formatResults(results),
        data: results,
        executionTimeMs: 0,
      };
    } catch (error) {
      return {
        success: false,
        output: `Search failed: ${error.message}`,
        error: error.message,
        executionTimeMs: 0,
      };
    }
  }

  private async performSearch(query: string) {
    // Implement using search API (DuckDuckGo, Google Custom Search, etc.)
  }
}
```

2. **Register Tool** (Infrastructure)

```typescript
// infrastructure/adapters/tools/registry.ts
export function createDefaultTools(config): Tool[] {
  return [
    new ShellTool(config.sandboxRoot),
    new FileTool(config.workspaceRoot),
    new HttpTool(),
    new CodeExecutionTool(config.sandboxRoot),
    new OllamaInfoTool(),
    new SearchTool(),  // ← Add here
  ];
}
```

3. **Tool Auto-Discovered at Startup**

Tools are automatically registered in bootstrap:

```typescript
const tools = createDefaultTools(config);
await toolRegistryService.registerAllTools(tools);
```

**Agents can now use the tool:**

```typescript
await createAgentUseCase.execute({
  name: 'Research Agent',
  allowedTools: ['web_search', 'file'],  // ← Include new tool
  // ...
});
```

### Adding a New Use Case

1. **Create Use Case Class** (Application)

```typescript
// application/use-cases/agents/export-agent.ts
export class ExportAgentUseCase {
  constructor(
    private agentPort: AgentPort,
    private tracePort: TracePort
  ) {}

  async execute(agentId: string): Promise<ExportData> {
    const agent = await this.agentPort.findById(agentId);
    if (!agent) {
      throw new ValidationError(`Agent ${agentId} not found`);
    }

    const runs = await this.tracePort.queryRuns({ agentId, limit: 100 });

    return {
      agent,
      runs,
      exportedAt: new Date(),
    };
  }
}
```

2. **Add to Factory** (Application)

```typescript
// application/factory.ts
export class UseCaseFactory {
  exportAgent() {
    return new ExportAgentUseCase(this.deps.agentPort, this.deps.tracePort);
  }
}
```

3. **Create API Route** (Presentation)

```typescript
// app/api/agents/[id]/export/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const container = await getContainer();
  const useCase = container.useCases.exportAgent();

  const data = await useCase.execute(params.id);

  return Response.json(data);
}
```

---

## Performance Considerations

### Caching Strategy

```typescript
// Model registry caches in memory
class DefaultModelRegistry {
  private models = new Map<string, ModelInfo>();  // ← In-memory cache

  async listAllModels(): Promise<ModelInfo[]> {
    if (this.models.size === 0) {
      await this.refresh();  // Lazy load
    }
    return Array.from(this.models.values());
  }
}

// Tool registry is in-memory (no cache needed)
class InMemoryToolRegistry {
  private tools = new Map<string, Tool>();  // ← Fast lookup
}
```

### Database Indexes

Critical indexes for query performance:

```sql
-- Agent lookup by ID (primary key already indexed)
-- Run queries by agent
CREATE INDEX idx_runs_agent_id ON runs(agent_id);

-- Recent runs
CREATE INDEX idx_runs_created_at ON runs(created_at);

-- Tool statistics
CREATE INDEX idx_tool_executions_tool_name ON tool_executions(tool_name);
```

### Streaming Optimizations

```typescript
// Use AsyncGenerator for memory-efficient streaming
async *generateStream(request): AsyncGenerator<StreamChunk> {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Yield immediately, don't buffer
    yield { type: 'content', content: decoder.decode(value) };
  }
}
```

### Connection Pooling

```typescript
// SQLite: Single connection (file-based)
// No connection pool needed for local use

// HTTP clients: Reuse connections
const keepAliveAgent = new https.Agent({ keepAlive: true });
fetch(url, { agent: keepAliveAgent });
```

### Lazy Loading

```typescript
// Bootstrap only loads essentials
await bootstrapApplication(config);

// Models loaded on first access
await modelRegistry.listAllModels();  // ← Triggers refresh

// Tools registered at startup (lightweight)
await toolRegistryService.registerAllTools(tools);
```

---

## Summary

This architecture provides:

1. **Loose Coupling**: Swap implementations without touching domain logic
2. **Testability**: Mock any port for unit testing
3. **Extensibility**: Add providers/tools without modifying existing code
4. **Type Safety**: TypeScript interfaces enforce contracts
5. **Security**: Tool sandboxing, authorization, API key management
6. **Observability**: Comprehensive logging and tracing
7. **Performance**: Caching, streaming, indexed queries

### Critical Success Factors

✅ **Strict dependency inversion** - All deps point inward
✅ **Clear boundaries** - Domain never imports infrastructure
✅ **Interface discipline** - Ports define contracts, adapters implement
✅ **Security by default** - Tools sandboxed, opt-in allowlist
✅ **Comprehensive testing** - Unit, integration, E2E coverage

### Next Steps for Implementation

1. Set up Next.js project structure
2. Implement database schema with Drizzle
3. Create core port interfaces
4. Implement adapters (Ollama first)
5. Build domain services
6. Create use cases
7. Wire up dependency injection
8. Implement API routes
9. Build UI components
10. Write tests

---

**Document Version:** 1.0
**Last Updated:** 2025-11-22
**Maintainer:** Engineering Team
