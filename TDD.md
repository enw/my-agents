# Technical Design Document (TDD)
## Local Agent Builder & Runner v0

**Document Version:** 1.0
**Last Updated:** 2025-11-22
**Status:** Draft
**Architecture Pattern:** Ports & Adapters (Hexagonal Architecture)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Core Design Principles](#3-core-design-principles)
4. [Module Structure](#4-module-structure)
5. [Domain Layer](#5-domain-layer)
6. [Application Layer](#6-application-layer)
7. [Infrastructure Layer](#7-infrastructure-layer)
8. [Presentation Layer](#8-presentation-layer)
9. [Agent Execution Flow](#9-agent-execution-flow)
10. [Security Architecture](#10-security-architecture)
11. [Data Persistence](#11-data-persistence)
12. [API Design](#12-api-design)
13. [Streaming Architecture](#13-streaming-architecture)
14. [Error Handling](#14-error-handling)
15. [Testing Strategy](#15-testing-strategy)
16. [Extension Points](#16-extension-points)
17. [Non-Functional Requirements](#17-non-functional-requirements)
18. [Implementation Roadmap](#18-implementation-roadmap)
19. [Appendices](#19-appendices)

---

## 1. Executive Summary

### 1.1 Purpose

The **Local Agent Builder & Runner** is a Next.js application designed to enable rapid prototyping, testing, and execution of tool-using AI agents. The system prioritizes local-first operation with seamless fallback to remote LLM providers.

### 1.2 Key Technical Goals

- **Extensibility**: Add new model providers or tools with minimal code changes
- **Testability**: Mock any infrastructure component for isolated testing
- **Security**: Sandboxed tool execution with per-agent allowlisting
- **Type Safety**: End-to-end TypeScript contracts
- **Performance**: Streaming responses with <300ms local startup latency

### 1.3 Architectural Pattern

The system employs **Hexagonal Architecture (Ports & Adapters)** to achieve complete separation between business logic and infrastructure concerns. All external dependencies (databases, LLM APIs, file systems) are abstracted behind port interfaces.

### 1.4 Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router), React, TypeScript, Tailwind CSS, ShadCN UI |
| **Backend** | Next.js Route Handlers, Server Actions |
| **Database** | SQLite with Drizzle ORM |
| **LLM Providers** | Ollama (local), OpenRouter, OpenAI, Anthropic (remote) |
| **Streaming** | Server-Sent Events (SSE) |

---

## 2. System Architecture Overview

### 2.1 Hexagonal Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│                  (Next.js App Router)                        │
│   ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │
│   │ UI Components│  │  API Routes  │  │ Server Actions│      │
│   └──────┬──────┘  └──────┬───────┘  └──────┬───────┘      │
│          │                 │                  │               │
└──────────┼─────────────────┼──────────────────┼──────────────┘
           │                 │                  │
           └─────────────────┴──────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│                    APPLICATION LAYER                         │
│                       (Use Cases)                            │
│                             │                                 │
│   ┌────────────────────────┴────────────────────────┐       │
│   │  CreateAgent │ ExecuteAgent │ ListModels  etc.  │       │
│   └────────────────────────┬────────────────────────┘       │
└────────────────────────────┼────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│                      DOMAIN LAYER                            │
│                   (Business Logic)                           │
│                             │                                 │
│   ┌─────────────────────────────────────────────┐           │
│   │     AgentExecutionService                    │           │
│   │     ModelSelectionService                    │           │
│   │     AgentValidationService                   │           │
│   └──────────────────┬──────────────────────────┘           │
│                      │                                        │
│   ┌──────────────────┴──────────────────────────┐           │
│   │            PORTS (Interfaces)                │           │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │           │
│   │  │ ModelPort│  │ AgentPort│  │ ToolPort │  │           │
│   │  └──────────┘  └──────────┘  └──────────┘  │           │
│   │  ┌──────────┐  ┌──────────┐                 │           │
│   │  │TracePort │  │ Registry │                 │           │
│   │  └──────────┘  └──────────┘                 │           │
│   └─────────────────────────────────────────────┘           │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                        │
│                      (Adapters)                              │
│                             │                                 │
│   ┌─────────────────────────┴──────────────────────┐        │
│   │        MODEL ADAPTERS                           │        │
│   │  ┌─────────────┐  ┌──────────────┐            │        │
│   │  │OllamaAdapter│  │OpenRouter    │ ...        │        │
│   │  └─────────────┘  └──────────────┘            │        │
│   └─────────────────────────────────────────────────┘        │
│                                                               │
│   ┌─────────────────────────────────────────────────┐        │
│   │     PERSISTENCE ADAPTERS                         │        │
│   │  ┌──────────────┐  ┌──────────────┐            │        │
│   │  │SQLiteAgent   │  │SQLiteTrace   │            │        │
│   │  │Repository    │  │Repository    │            │        │
│   │  └──────────────┘  └──────────────┘            │        │
│   └─────────────────────────────────────────────────┘        │
│                                                               │
│   ┌─────────────────────────────────────────────────┐        │
│   │         TOOL ADAPTERS                            │        │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │        │
│   │  │ShellTool │  │HTTPTool  │  │FileTool  │      │        │
│   │  └──────────┘  └──────────┘  └──────────┘      │        │
│   └─────────────────────────────────────────────────┘        │
│                                                               │
│   ┌─────────────────────────────────────────────────┐        │
│   │         EXTERNAL SYSTEMS                         │        │
│   │   SQLite DB │ Ollama API │ OpenRouter API      │        │
│   └─────────────────────────────────────────────────┘        │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 Dependency Direction

**Critical Rule**: All dependencies point INWARD toward the domain layer.

- Presentation depends on Application
- Application depends on Domain
- Infrastructure depends on Domain (implements ports)
- Domain depends on NOTHING (only interfaces)

This ensures the core business logic is independent of frameworks, databases, and external services.

---

## 3. Core Design Principles

### 3.1 Dependency Inversion Principle (DIP)

High-level modules (domain) do not depend on low-level modules (infrastructure). Both depend on abstractions (ports).

**Example:**
```typescript
// ✅ CORRECT: Domain service depends on port interface
class AgentExecutionService {
  constructor(private modelPort: ModelPort) {}

  async execute(agent: Agent) {
    const response = await this.modelPort.generate(/* ... */);
  }
}

// ❌ WRONG: Direct dependency on concrete implementation
class AgentExecutionService {
  constructor(private ollama: OllamaAdapter) {} // Tight coupling!
}
```

### 3.2 Interface Segregation Principle (ISP)

Clients should not depend on interfaces they don't use. Each port defines a minimal, focused contract.

**Example:**
```typescript
// ✅ CORRECT: Focused interfaces
interface ModelPort {
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}

interface ModelRegistryPort {
  listAvailableModels(): Promise<ModelInfo[]>;
}

// ❌ WRONG: Fat interface
interface ModelPort {
  generate(...);
  listModels();
  updateMetadata();
  calculateCost();
  // Too many responsibilities!
}
```

### 3.3 Single Responsibility Principle (SRP)

Each module has one reason to change.

- **Domain Services**: Business rules only
- **Adapters**: Infrastructure integration only
- **Use Cases**: Orchestrate workflows only

### 3.4 Open/Closed Principle (OCP)

Open for extension, closed for modification.

**Adding a new model provider:**
```typescript
// Extend without modifying existing code
class AnthropicAdapter implements ModelPort {
  // New implementation
}

// Register in factory
ModelFactory.register('anthropic', AnthropicAdapter);
```

### 3.5 Fail Fast

Validate at system boundaries, make illegal states unrepresentable.

```typescript
// Validate tool access at execution boundary
if (!agent.allowedTools.includes(toolName)) {
  throw new ToolNotAllowedError(toolName, agent.id);
}
```

---

## 4. Module Structure

### 4.1 Directory Layout

```
src/
├── domain/                         # Business logic (no external deps)
│   ├── ports/                      # Interface definitions
│   │   ├── model.port.ts
│   │   ├── agent.port.ts
│   │   ├── tool.port.ts
│   │   ├── trace.port.ts
│   │   └── index.ts
│   ├── services/                   # Core business logic
│   │   ├── agent-execution.service.ts
│   │   ├── agent-validation.service.ts
│   │   └── model-selection.service.ts
│   ├── entities/                   # Domain models
│   │   ├── agent.entity.ts
│   │   ├── run-log.entity.ts
│   │   └── model-info.entity.ts
│   └── errors/                     # Domain exceptions
│       └── domain-errors.ts
│
├── application/                    # Use cases (orchestration)
│   ├── use-cases/
│   │   ├── create-agent.use-case.ts
│   │   ├── execute-agent.use-case.ts
│   │   ├── list-models.use-case.ts
│   │   └── get-run-history.use-case.ts
│   └── dto/                        # Data transfer objects
│       └── agent.dto.ts
│
├── infrastructure/                 # External integrations
│   ├── adapters/
│   │   ├── models/
│   │   │   ├── ollama.adapter.ts
│   │   │   ├── openrouter.adapter.ts
│   │   │   ├── openai.adapter.ts
│   │   │   └── anthropic.adapter.ts
│   │   ├── persistence/
│   │   │   ├── schema.ts           # Drizzle schema
│   │   │   ├── agent.repository.ts
│   │   │   ├── trace.repository.ts
│   │   │   └── model-registry.repository.ts
│   │   ├── tools/
│   │   │   ├── shell.tool.ts
│   │   │   ├── http.tool.ts
│   │   │   ├── file.tool.ts
│   │   │   └── code-executor.tool.ts
│   │   └── streaming/
│   │       └── sse.adapter.ts
│   ├── config/
│   │   └── bootstrap.ts            # DI container
│   └── external/
│       └── ollama-client.ts
│
└── presentation/                   # Next.js layer
    └── app/
        ├── api/
        │   ├── agents/
        │   │   └── route.ts
        │   ├── run/
        │   │   └── route.ts
        │   ├── models/
        │   │   └── route.ts
        │   └── tools/
        │       └── route.ts
        ├── components/
        │   ├── agent-list.tsx
        │   ├── chat-interface.tsx
        │   └── trace-viewer.tsx
        └── page.tsx
```

### 4.2 Module Dependencies

```
presentation → application → domain ← infrastructure
```

**Key Constraint:** Infrastructure cannot be imported by domain or application layers.

---

## 5. Domain Layer

The domain layer contains the **core business logic** with zero dependencies on frameworks or external systems.

### 5.1 Port Interfaces

Ports define contracts for external systems without specifying implementation.

#### 5.1.1 ModelPort

**Purpose:** Abstract LLM provider interface

```typescript
export interface GenerateRequest {
  systemPrompt: string;
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface GenerateResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: { inputTokens: number; outputTokens: number };
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  metadata?: Record<string, any>;
}

export interface ModelPort {
  generate(request: GenerateRequest): Promise<GenerateResponse>;
  streamGenerate(request: GenerateRequest): AsyncIterator<StreamChunk>;
}
```

**Implementations:**
- `OllamaAdapter` - Local models via http://localhost:11434
- `OpenRouterAdapter` - Multi-provider API
- `OpenAIAdapter` - Direct OpenAI integration
- `AnthropicAdapter` - Direct Anthropic integration

#### 5.1.2 AgentPort

**Purpose:** Agent persistence and retrieval

```typescript
export interface AgentPort {
  create(agent: CreateAgentDto): Promise<Agent>;
  findById(id: string): Promise<Agent | null>;
  findAll(filters?: AgentFilters): Promise<Agent[]>;
  update(id: string, updates: Partial<Agent>): Promise<Agent>;
  delete(id: string): Promise<void>;
}
```

**Implementation:**
- `SQLiteAgentRepository` - SQLite persistence with Drizzle ORM

#### 5.1.3 ToolPort

**Purpose:** Tool registry and execution

```typescript
export interface ToolExecutionResult {
  success: boolean;
  output: any;
  error?: string;
  executionTime: number;
}

export interface ToolPort {
  register(tool: Tool): void;
  execute(name: string, params: any): Promise<ToolExecutionResult>;
  getAvailable(): ToolDefinition[];
  getByName(name: string): Tool | undefined;
}

export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchemaType<any>;
  run(params: any): Promise<any>;
}
```

**Implementations:**
- `InMemoryToolRegistry` - Fast, ephemeral registry
- Tools: `ShellTool`, `HTTPTool`, `FileTool`, `CodeExecutorTool`

#### 5.1.4 TracePort

**Purpose:** Execution logging and observability

```typescript
export interface TracePort {
  createRun(agentId: string, model: string): Promise<string>;
  appendTurn(runId: string, turn: ConversationTurn): Promise<void>;
  logToolExecution(runId: string, toolLog: ToolExecutionLog): Promise<void>;
  completeRun(runId: string, status: RunStatus): Promise<void>;
  getRunHistory(agentId?: string, limit?: number): Promise<RunLog[]>;
  getRunById(runId: string): Promise<RunLog | null>;
}
```

**Implementation:**
- `SQLiteTraceRepository` - Persistent execution logs

#### 5.1.5 ModelRegistryPort

**Purpose:** Discover and manage available models

```typescript
export interface ModelRegistryPort {
  refreshAvailableModels(): Promise<void>;
  getAvailableModels(): Promise<ModelInfo[]>;
  getModelById(id: string): Promise<ModelInfo | null>;
  updateModelMetadata(id: string, metadata: Partial<ModelInfo>): Promise<void>;
}
```

### 5.2 Domain Services

Domain services contain business logic that doesn't naturally fit into entities.

#### 5.2.1 AgentExecutionService

**Responsibility:** Execute agents using the ReAct (Reasoning + Acting) pattern

```typescript
export class AgentExecutionService {
  constructor(
    private modelPort: ModelPort,
    private toolPort: ToolPort,
    private tracePort: TracePort
  ) {}

  async executeAgentLoop(
    agent: Agent,
    userMessage: string,
    modelOverride?: string
  ): Promise<{ runId: string; status: RunStatus }> {
    // 1. Create run log
    const runId = await this.tracePort.createRun(agent.id, modelOverride ?? agent.defaultModel);

    // 2. Initialize conversation
    const messages: Message[] = [
      { role: 'user', content: userMessage }
    ];

    // 3. ReAct loop (max 10 turns)
    for (let turn = 0; turn < 10; turn++) {
      const response = await this.modelPort.generate({
        systemPrompt: agent.systemPrompt,
        messages,
        tools: this.getAvailableTools(agent.allowedTools),
        temperature: agent.temperature
      });

      // Log turn
      await this.tracePort.appendTurn(runId, {
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls
      });

      // Handle tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults = await this.executeTools(
          agent,
          response.toolCalls,
          runId
        );

        messages.push({ role: 'assistant', content: response.content, toolCalls: response.toolCalls });
        messages.push({ role: 'tool', content: JSON.stringify(toolResults) });

        continue; // Next loop iteration
      }

      // No tool calls = conversation complete
      await this.tracePort.completeRun(runId, 'completed');
      return { runId, status: 'completed' };
    }

    // Max turns reached
    await this.tracePort.completeRun(runId, 'max_turns_reached');
    return { runId, status: 'max_turns_reached' };
  }

  private async executeTools(
    agent: Agent,
    toolCalls: ToolCall[],
    runId: string
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const call of toolCalls) {
      // Security: Validate tool is allowed
      if (!agent.allowedTools.includes(call.name)) {
        throw new ToolNotAllowedError(call.name, agent.id);
      }

      const result = await this.toolPort.execute(call.name, call.parameters);
      await this.tracePort.logToolExecution(runId, {
        toolName: call.name,
        input: call.parameters,
        output: result.output,
        success: result.success,
        executionTime: result.executionTime
      });

      results.push(result);
    }

    return results;
  }
}
```

#### 5.2.2 AgentValidationService

**Responsibility:** Validate agent configurations

```typescript
export class AgentValidationService {
  validate(agent: CreateAgentDto): ValidationResult {
    const errors: string[] = [];

    if (!agent.name || agent.name.trim().length === 0) {
      errors.push('Agent name is required');
    }

    if (!agent.systemPrompt || agent.systemPrompt.trim().length === 0) {
      errors.push('System prompt is required');
    }

    if (agent.temperature !== undefined && (agent.temperature < 0 || agent.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }

    if (agent.allowedTools) {
      const availableTools = this.toolPort.getAvailable().map(t => t.name);
      const invalidTools = agent.allowedTools.filter(t => !availableTools.includes(t));
      if (invalidTools.length > 0) {
        errors.push(`Invalid tools: ${invalidTools.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

#### 5.2.3 ModelSelectionService

**Responsibility:** Select optimal model for task (v1 feature - stub in v0)

```typescript
export class ModelSelectionService {
  constructor(private modelRegistryPort: ModelRegistryPort) {}

  async selectOptimalModel(
    task: string,
    constraints?: { maxCost?: number; minSpeed?: number }
  ): Promise<ModelInfo | null> {
    // v0: Return default, log metadata for future ML
    // v1: Use logged performance data to auto-select
    return null;
  }
}
```

### 5.3 Domain Entities

#### 5.3.1 Agent

```typescript
export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  defaultModel: string;
  allowedTools: string[];
  tags: string[];
  temperature: number;
  maxTokens: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 5.3.2 RunLog

```typescript
export interface RunLog {
  id: string;
  agentId: string;
  model: string;
  status: 'running' | 'completed' | 'failed' | 'max_turns_reached';
  turns: ConversationTurn[];
  toolExecutions: ToolExecutionLog[];
  usage: TokenUsage;
  createdAt: Date;
  completedAt?: Date;
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

export interface ToolExecutionLog {
  toolName: string;
  input: any;
  output: any;
  success: boolean;
  executionTime: number;
  timestamp: Date;
}
```

#### 5.3.3 ModelInfo

```typescript
export interface ModelInfo {
  id: string;
  provider: 'ollama' | 'openrouter' | 'openai' | 'anthropic';
  name: string;
  displayName: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  cost?: { input: number; output: number }; // Per 1M tokens
  speed?: number; // Tokens/sec (measured)
  strengths?: string[];
  lastUsed?: Date;
}
```

### 5.4 Domain Errors

```typescript
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AgentNotFoundError extends DomainError {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`);
  }
}

export class ToolNotAllowedError extends DomainError {
  constructor(toolName: string, agentId: string) {
    super(`Tool '${toolName}' not allowed for agent ${agentId}`);
  }
}

export class ModelProviderError extends DomainError {
  constructor(provider: string, message: string) {
    super(`${provider} error: ${message}`);
  }
}

export class ToolExecutionError extends DomainError {
  constructor(toolName: string, error: string) {
    super(`Tool '${toolName}' execution failed: ${error}`);
  }
}
```

---

## 6. Application Layer

The application layer orchestrates use cases by coordinating domain services and ports.

### 6.1 Use Cases

#### 6.1.1 CreateAgentUseCase

```typescript
export class CreateAgentUseCase {
  constructor(
    private agentPort: AgentPort,
    private validationService: AgentValidationService
  ) {}

  async execute(dto: CreateAgentDto): Promise<Agent> {
    // Validate
    const validation = this.validationService.validate(dto);
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }

    // Create
    const agent = await this.agentPort.create(dto);
    return agent;
  }
}
```

#### 6.1.2 ExecuteAgentUseCase

```typescript
export class ExecuteAgentUseCase {
  constructor(
    private agentPort: AgentPort,
    private executionService: AgentExecutionService
  ) {}

  async execute(request: ExecuteAgentRequest): Promise<ExecuteAgentResponse> {
    // Load agent
    const agent = await this.agentPort.findById(request.agentId);
    if (!agent) {
      throw new AgentNotFoundError(request.agentId);
    }

    // Execute
    const result = await this.executionService.executeAgentLoop(
      agent,
      request.message,
      request.modelOverride
    );

    return {
      runId: result.runId,
      status: result.status
    };
  }
}
```

#### 6.1.3 ListModelsUseCase

```typescript
export class ListModelsUseCase {
  constructor(private modelRegistryPort: ModelRegistryPort) {}

  async execute(): Promise<ModelInfo[]> {
    await this.modelRegistryPort.refreshAvailableModels();
    return this.modelRegistryPort.getAvailableModels();
  }
}
```

#### 6.1.4 GetRunHistoryUseCase

```typescript
export class GetRunHistoryUseCase {
  constructor(private tracePort: TracePort) {}

  async execute(agentId?: string, limit: number = 50): Promise<RunLog[]> {
    return this.tracePort.getRunHistory(agentId, limit);
  }
}
```

### 6.2 Data Transfer Objects (DTOs)

```typescript
export interface CreateAgentDto {
  name: string;
  description: string;
  systemPrompt: string;
  defaultModel: string;
  allowedTools: string[];
  tags?: string[];
  temperature?: number;
  maxTokens?: number;
}

export interface ExecuteAgentRequest {
  agentId: string;
  message: string;
  modelOverride?: string;
  stream?: boolean;
}

export interface ExecuteAgentResponse {
  runId: string;
  status: RunStatus;
}
```

---

## 7. Infrastructure Layer

The infrastructure layer implements ports using concrete technologies.

### 7.1 Model Adapters

#### 7.1.1 OllamaAdapter

**Purpose:** Local model execution via Ollama

```typescript
export class OllamaAdapter implements ModelPort {
  private baseUrl = 'http://localhost:11434';

  constructor(private modelName: string) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          { role: 'system', content: request.systemPrompt },
          ...request.messages
        ],
        tools: request.tools,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens
        }
      })
    });

    if (!response.ok) {
      throw new ModelProviderError('ollama', await response.text());
    }

    const data = await response.json();

    return {
      content: data.message.content,
      toolCalls: this.parseToolCalls(data.message.tool_calls),
      usage: {
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count || 0
      },
      finishReason: this.mapFinishReason(data.done_reason)
    };
  }

  async *streamGenerate(request: GenerateRequest): AsyncIterator<StreamChunk> {
    // Streaming implementation
  }
}
```

#### 7.1.2 OpenRouterAdapter

**Purpose:** Multi-provider remote models

```typescript
export class OpenRouterAdapter implements ModelPort {
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(
    private modelName: string,
    private apiKey: string
  ) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Local Agent Builder'
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          { role: 'system', content: request.systemPrompt },
          ...request.messages
        ],
        tools: request.tools,
        temperature: request.temperature,
        max_tokens: request.maxTokens
      })
    });

    if (!response.ok) {
      throw new ModelProviderError('openrouter', await response.text());
    }

    const data = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens
      },
      finishReason: choice.finish_reason
    };
  }
}
```

### 7.2 Persistence Adapters

#### 7.2.1 Database Schema (Drizzle)

```typescript
// schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  defaultModel: text('default_model').notNull(),
  allowedTools: text('allowed_tools').notNull(), // JSON array
  tags: text('tags').notNull(), // JSON array
  temperature: real('temperature').default(0.7),
  maxTokens: integer('max_tokens').default(4096),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const runLogs = sqliteTable('run_logs', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id),
  model: text('model').notNull(),
  status: text('status').notNull(),
  turns: text('turns').notNull(), // JSON array
  toolExecutions: text('tool_executions').notNull(), // JSON array
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' })
});

export const modelMetadata = sqliteTable('model_metadata', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  contextWindow: integer('context_window'),
  maxOutputTokens: integer('max_output_tokens'),
  costInput: real('cost_input'),
  costOutput: real('cost_output'),
  speed: real('speed'),
  strengths: text('strengths'), // JSON array
  lastUsed: integer('last_used', { mode: 'timestamp' })
});
```

#### 7.2.2 SQLiteAgentRepository

```typescript
export class SQLiteAgentRepository implements AgentPort {
  constructor(private db: DrizzleDB) {}

  async create(dto: CreateAgentDto): Promise<Agent> {
    const id = randomUUID();
    const now = new Date();

    await this.db.insert(agents).values({
      id,
      ...dto,
      allowedTools: JSON.stringify(dto.allowedTools),
      tags: JSON.stringify(dto.tags || []),
      createdAt: now,
      updatedAt: now
    });

    return this.findById(id);
  }

  async findById(id: string): Promise<Agent | null> {
    const result = await this.db.select().from(agents).where(eq(agents.id, id));
    if (result.length === 0) return null;
    return this.mapToEntity(result[0]);
  }

  async findAll(filters?: AgentFilters): Promise<Agent[]> {
    let query = this.db.select().from(agents);

    if (filters?.tags) {
      // Filter by tags (JSON search)
    }

    const results = await query;
    return results.map(r => this.mapToEntity(r));
  }

  private mapToEntity(row: any): Agent {
    return {
      ...row,
      allowedTools: JSON.parse(row.allowedTools),
      tags: JSON.parse(row.tags)
    };
  }
}
```

#### 7.2.3 SQLiteTraceRepository

```typescript
export class SQLiteTraceRepository implements TracePort {
  constructor(private db: DrizzleDB) {}

  async createRun(agentId: string, model: string): Promise<string> {
    const id = randomUUID();
    await this.db.insert(runLogs).values({
      id,
      agentId,
      model,
      status: 'running',
      turns: JSON.stringify([]),
      toolExecutions: JSON.stringify([]),
      createdAt: new Date()
    });
    return id;
  }

  async appendTurn(runId: string, turn: ConversationTurn): Promise<void> {
    const run = await this.db.select().from(runLogs).where(eq(runLogs.id, runId));
    if (!run.length) throw new Error('Run not found');

    const turns = JSON.parse(run[0].turns);
    turns.push({ ...turn, timestamp: new Date() });

    await this.db.update(runLogs)
      .set({ turns: JSON.stringify(turns) })
      .where(eq(runLogs.id, runId));
  }

  async logToolExecution(runId: string, toolLog: ToolExecutionLog): Promise<void> {
    const run = await this.db.select().from(runLogs).where(eq(runLogs.id, runId));
    if (!run.length) throw new Error('Run not found');

    const executions = JSON.parse(run[0].toolExecutions);
    executions.push({ ...toolLog, timestamp: new Date() });

    await this.db.update(runLogs)
      .set({ toolExecutions: JSON.stringify(executions) })
      .where(eq(runLogs.id, runId));
  }

  async completeRun(runId: string, status: RunStatus): Promise<void> {
    await this.db.update(runLogs)
      .set({ status, completedAt: new Date() })
      .where(eq(runLogs.id, runId));
  }

  async getRunHistory(agentId?: string, limit: number = 50): Promise<RunLog[]> {
    let query = this.db.select().from(runLogs);

    if (agentId) {
      query = query.where(eq(runLogs.agentId, agentId));
    }

    const results = await query
      .orderBy(desc(runLogs.createdAt))
      .limit(limit);

    return results.map(r => this.mapToEntity(r));
  }
}
```

### 7.3 Tool Adapters

#### 7.3.1 ShellTool

**Security:** Restricted to temporary directory, command timeout

```typescript
export class ShellTool implements Tool {
  name = 'shell';
  description = 'Execute shell commands in a sandboxed temporary directory';
  parameters = {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' }
    },
    required: ['command']
  };

  private workspaceDir: string;

  constructor() {
    this.workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-shell-'));
  }

  async run(params: { command: string }): Promise<any> {
    // Security: Basic command validation
    if (params.command.includes('rm -rf /') || params.command.includes('sudo')) {
      throw new Error('Command not allowed');
    }

    const { stdout, stderr } = await execAsync(params.command, {
      cwd: this.workspaceDir,
      timeout: 30000, // 30s timeout
      maxBuffer: 1024 * 1024 // 1MB
    });

    return {
      stdout,
      stderr,
      cwd: this.workspaceDir
    };
  }

  cleanup() {
    fs.rmSync(this.workspaceDir, { recursive: true, force: true });
  }
}
```

#### 7.3.2 HTTPTool

```typescript
export class HTTPTool implements Tool {
  name = 'http';
  description = 'Fetch data from HTTP endpoints';
  parameters = {
    type: 'object',
    properties: {
      url: { type: 'string', format: 'uri' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
      headers: { type: 'object' },
      body: { type: 'string' }
    },
    required: ['url']
  };

  async run(params: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(params.url, {
        method: params.method || 'GET',
        headers: params.headers,
        body: params.body,
        signal: controller.signal
      });

      const contentType = response.headers.get('content-type');
      const data = contentType?.includes('application/json')
        ? await response.json()
        : await response.text();

      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

#### 7.3.3 FileTool

**Security:** Restricted to workspace directory

```typescript
export class FileTool implements Tool {
  name = 'file';
  description = 'Read and write files in the workspace directory';
  parameters = {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['read', 'write', 'list'] },
      path: { type: 'string' },
      content: { type: 'string' }
    },
    required: ['operation', 'path']
  };

  private workspaceDir: string;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
  }

  async run(params: {
    operation: 'read' | 'write' | 'list';
    path: string;
    content?: string;
  }): Promise<any> {
    // Security: Prevent path traversal
    const safePath = path.join(this.workspaceDir, params.path);
    if (!safePath.startsWith(this.workspaceDir)) {
      throw new Error('Path traversal not allowed');
    }

    switch (params.operation) {
      case 'read':
        return { content: await fs.promises.readFile(safePath, 'utf-8') };

      case 'write':
        await fs.promises.writeFile(safePath, params.content || '', 'utf-8');
        return { success: true };

      case 'list':
        const entries = await fs.promises.readdir(safePath, { withFileTypes: true });
        return {
          files: entries.filter(e => e.isFile()).map(e => e.name),
          directories: entries.filter(e => e.isDirectory()).map(e => e.name)
        };

      default:
        throw new Error(`Unknown operation: ${params.operation}`);
    }
  }
}
```

#### 7.3.4 CodeExecutorTool

**Security:** Sandboxed execution in isolated environment

```typescript
export class CodeExecutorTool implements Tool {
  name = 'execute_code';
  description = 'Execute Python or JavaScript code in a sandboxed environment';
  parameters = {
    type: 'object',
    properties: {
      language: { type: 'string', enum: ['python', 'javascript'] },
      code: { type: 'string' }
    },
    required: ['language', 'code']
  };

  async run(params: { language: 'python' | 'javascript'; code: string }): Promise<any> {
    const tempFile = path.join(os.tmpdir(), `code-${randomUUID()}.${params.language === 'python' ? 'py' : 'js'}`);

    try {
      await fs.promises.writeFile(tempFile, params.code, 'utf-8');

      const command = params.language === 'python'
        ? `python3 ${tempFile}`
        : `node ${tempFile}`;

      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024
      });

      return { stdout, stderr };
    } finally {
      await fs.promises.unlink(tempFile).catch(() => {});
    }
  }
}
```

### 7.4 Tool Registry

```typescript
export class InMemoryToolRegistry implements ToolPort {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  async execute(name: string, params: any): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    const startTime = Date.now();

    try {
      const output = await tool.run(params);
      return {
        success: true,
        output,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  getAvailable(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  getByName(name: string): Tool | undefined {
    return this.tools.get(name);
  }
}
```

### 7.5 Model Registry

```typescript
export class ModelRegistryService implements ModelRegistryPort {
  private models: ModelInfo[] = [];

  constructor(
    private ollamaClient: OllamaClient,
    private db: DrizzleDB
  ) {}

  async refreshAvailableModels(): Promise<void> {
    this.models = [];

    // Fetch Ollama models
    try {
      const ollamaModels = await this.ollamaClient.listModels();
      this.models.push(...ollamaModels.map(m => ({
        id: `ollama/${m.name}`,
        provider: 'ollama' as const,
        name: m.name,
        displayName: m.name,
        contextWindow: undefined,
        speed: undefined
      })));
    } catch (error) {
      console.warn('Ollama not available:', error.message);
    }

    // Fetch OpenRouter models (hardcoded popular models)
    this.models.push(
      {
        id: 'openrouter/anthropic/claude-3.5-sonnet',
        provider: 'openrouter',
        name: 'anthropic/claude-3.5-sonnet',
        displayName: 'Claude 3.5 Sonnet',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        cost: { input: 3, output: 15 },
        strengths: ['coding', 'analysis', 'tool-use']
      },
      {
        id: 'openrouter/openai/gpt-4o',
        provider: 'openrouter',
        name: 'openai/gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128000,
        maxOutputTokens: 16384,
        cost: { input: 2.5, output: 10 },
        strengths: ['general-purpose', 'vision', 'tool-use']
      }
      // Add more models...
    );

    // Load metadata from database
    const storedMetadata = await this.db.select().from(modelMetadata);
    for (const stored of storedMetadata) {
      const model = this.models.find(m => m.id === stored.id);
      if (model) {
        model.speed = stored.speed;
        model.lastUsed = stored.lastUsed;
      }
    }
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    if (this.models.length === 0) {
      await this.refreshAvailableModels();
    }
    return this.models;
  }

  async getModelById(id: string): Promise<ModelInfo | null> {
    const models = await this.getAvailableModels();
    return models.find(m => m.id === id) || null;
  }

  async updateModelMetadata(id: string, metadata: Partial<ModelInfo>): Promise<void> {
    await this.db.insert(modelMetadata)
      .values({ id, ...metadata })
      .onConflictDoUpdate({ target: [modelMetadata.id], set: metadata });
  }
}
```

### 7.6 Dependency Injection Container

```typescript
// bootstrap.ts
export class DependencyContainer {
  private static instance: DependencyContainer;

  // Ports
  public agentPort: AgentPort;
  public toolPort: ToolPort;
  public tracePort: TracePort;
  public modelRegistryPort: ModelRegistryPort;

  // Services
  public agentExecutionService: AgentExecutionService;
  public agentValidationService: AgentValidationService;
  public modelSelectionService: ModelSelectionService;

  // Use Cases
  public createAgentUseCase: CreateAgentUseCase;
  public executeAgentUseCase: ExecuteAgentUseCase;
  public listModelsUseCase: ListModelsUseCase;
  public getRunHistoryUseCase: GetRunHistoryUseCase;

  private constructor() {
    // Initialize database
    const db = drizzle(new Database('./data/agents.db'));

    // Initialize tool registry
    this.toolPort = new InMemoryToolRegistry();
    this.toolPort.register(new ShellTool());
    this.toolPort.register(new HTTPTool());
    this.toolPort.register(new FileTool('./workspace'));
    this.toolPort.register(new CodeExecutorTool());

    // Initialize persistence adapters
    this.agentPort = new SQLiteAgentRepository(db);
    this.tracePort = new SQLiteTraceRepository(db);

    // Initialize model registry
    const ollamaClient = new OllamaClient();
    this.modelRegistryPort = new ModelRegistryService(ollamaClient, db);

    // Initialize domain services
    this.agentExecutionService = new AgentExecutionService(
      null, // ModelPort created dynamically per request
      this.toolPort,
      this.tracePort
    );

    this.agentValidationService = new AgentValidationService(this.toolPort);
    this.modelSelectionService = new ModelSelectionService(this.modelRegistryPort);

    // Initialize use cases
    this.createAgentUseCase = new CreateAgentUseCase(
      this.agentPort,
      this.agentValidationService
    );

    this.executeAgentUseCase = new ExecuteAgentUseCase(
      this.agentPort,
      this.agentExecutionService
    );

    this.listModelsUseCase = new ListModelsUseCase(this.modelRegistryPort);
    this.getRunHistoryUseCase = new GetRunHistoryUseCase(this.tracePort);
  }

  public static getInstance(): DependencyContainer {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer();
    }
    return DependencyContainer.instance;
  }

  public createModelPort(modelId: string): ModelPort {
    const [provider, ...modelParts] = modelId.split('/');
    const modelName = modelParts.join('/');

    switch (provider) {
      case 'ollama':
        return new OllamaAdapter(modelName);

      case 'openrouter':
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
        return new OpenRouterAdapter(modelName, apiKey);

      case 'openai':
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) throw new Error('OPENAI_API_KEY not set');
        return new OpenAIAdapter(modelName, openaiKey);

      case 'anthropic':
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set');
        return new AnthropicAdapter(modelName, anthropicKey);

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}
```

---

## 8. Presentation Layer

The presentation layer handles HTTP routing and UI rendering.

### 8.1 API Routes

#### 8.1.1 `/api/agents` - Agent CRUD

```typescript
// app/api/agents/route.ts
import { DependencyContainer } from '@/infrastructure/config/bootstrap';

export async function GET(request: Request) {
  const container = DependencyContainer.getInstance();
  const agents = await container.agentPort.findAll();
  return Response.json(agents);
}

export async function POST(request: Request) {
  const container = DependencyContainer.getInstance();
  const body = await request.json();

  try {
    const agent = await container.createAgentUseCase.execute(body);
    return Response.json(agent, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ errors: error.errors }, { status: 400 });
    }
    throw error;
  }
}

export async function PUT(request: Request) {
  const container = DependencyContainer.getInstance();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const body = await request.json();

  const updated = await container.agentPort.update(id, body);
  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const container = DependencyContainer.getInstance();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  await container.agentPort.delete(id);
  return Response.json({ success: true });
}
```

#### 8.1.2 `/api/run` - Execute Agent

```typescript
// app/api/run/route.ts
import { DependencyContainer } from '@/infrastructure/config/bootstrap';

export async function POST(request: Request) {
  const container = DependencyContainer.getInstance();
  const { agentId, message, modelOverride, stream } = await request.json();

  if (stream) {
    // Return SSE stream
    const encoder = new TextEncoder();
    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          const agent = await container.agentPort.findById(agentId);
          if (!agent) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Agent not found' })}\n\n`));
            controller.close();
            return;
          }

          const runId = await container.tracePort.createRun(agent.id, modelOverride || agent.defaultModel);

          // Execute with streaming
          const modelPort = container.createModelPort(modelOverride || agent.defaultModel);

          for await (const chunk of modelPort.streamGenerate({
            systemPrompt: agent.systemPrompt,
            messages: [{ role: 'user', content: message }],
            tools: container.toolPort.getAvailable()
          })) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }

  // Non-streaming execution
  const result = await container.executeAgentUseCase.execute({
    agentId,
    message,
    modelOverride
  });

  return Response.json(result);
}
```

#### 8.1.3 `/api/models` - List Models

```typescript
// app/api/models/route.ts
import { DependencyContainer } from '@/infrastructure/config/bootstrap';

export async function GET() {
  const container = DependencyContainer.getInstance();
  const models = await container.listModelsUseCase.execute();
  return Response.json(models);
}
```

#### 8.1.4 `/api/runs` - Run History

```typescript
// app/api/runs/route.ts
import { DependencyContainer } from '@/infrastructure/config/bootstrap';

export async function GET(request: Request) {
  const container = DependencyContainer.getInstance();
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const limit = parseInt(searchParams.get('limit') || '50');

  const runs = await container.getRunHistoryUseCase.execute(agentId, limit);
  return Response.json(runs);
}
```

### 8.2 UI Components (High-Level Overview)

**Sidebar: Agent List**
```tsx
// components/agent-list.tsx
export function AgentList() {
  const { data: agents } = useQuery(['agents'], () =>
    fetch('/api/agents').then(r => r.json())
  );

  return (
    <div className="w-64 border-r">
      {agents?.map(agent => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
      <Button onClick={createNewAgent}>+ New Agent</Button>
    </div>
  );
}
```

**Main Panel: Chat Interface**
```tsx
// components/chat-interface.tsx
export function ChatInterface({ agentId }: { agentId: string }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const handleSend = async () => {
    const eventSource = new EventSource(`/api/run?agentId=${agentId}&message=${input}&stream=true`);

    eventSource.onmessage = (event) => {
      const chunk = JSON.parse(event.data);
      if (chunk.content) {
        setMessages(prev => [...prev, chunk]);
      }
    };
  };

  return (
    <div className="flex-1 flex flex-col">
      <MessageList messages={messages} />
      <ChatInput value={input} onChange={setInput} onSend={handleSend} />
    </div>
  );
}
```

**Right Panel: Trace Viewer**
```tsx
// components/trace-viewer.tsx
export function TraceViewer({ runId }: { runId: string }) {
  const { data: run } = useQuery(['run', runId], () =>
    fetch(`/api/runs/${runId}`).then(r => r.json())
  );

  return (
    <div className="w-80 border-l overflow-y-auto">
      <h3>Execution Trace</h3>
      {run?.turns.map((turn, i) => (
        <TurnCard key={i} turn={turn} />
      ))}
      {run?.toolExecutions.map((exec, i) => (
        <ToolExecutionCard key={i} execution={exec} />
      ))}
    </div>
  );
}
```

---

## 9. Agent Execution Flow

### 9.1 ReAct Pattern (Reasoning + Acting)

The system implements the **ReAct pattern**, alternating between:
1. **Reasoning**: LLM generates response (possibly with tool calls)
2. **Acting**: Tools are executed
3. **Observing**: Tool results added to conversation
4. **Loop**: Repeat until task complete or max turns reached

### 9.2 Execution Sequence Diagram

```
User                 API             UseCase         ExecutionService    ModelPort       ToolPort        TracePort
 │                    │                 │                    │              │              │              │
 ├─POST /api/run─────>│                 │                    │              │              │              │
 │                    ├─execute()──────>│                    │              │              │              │
 │                    │                 ├─findById()─────────┼──────────────┼──────────────┼─────────────>│
 │                    │                 │<────────(agent)────┘              │              │              │
 │                    │                 │                    │              │              │              │
 │                    │                 ├─executeLoop()─────>│              │              │              │
 │                    │                 │                    ├─createRun()──┼──────────────┼─────────────>│
 │                    │                 │                    │<─────(runId)─┘              │              │
 │                    │                 │                    │              │              │              │
 │                    │                 │                    ├─generate()──>│              │              │
 │                    │                 │                    │<─(response)──┘              │              │
 │                    │                 │                    │              │              │              │
 │                    │                 │                    ├───IF toolCalls────>         │              │
 │                    │                 │                    │              │              │              │
 │                    │                 │                    ├──────────────┼─execute()───>│              │
 │                    │                 │                    │<─────────────┼──(result)────┘              │
 │                    │                 │                    ├──────────────┼──────────────┼─logTool()───>│
 │                    │                 │                    │              │              │              │
 │                    │                 │                    ├─────(loop continues)────────┼──────────────┤
 │                    │                 │                    │              │              │              │
 │                    │                 │                    ├─completeRun()────────────────────────────>│
 │                    │                 │<───(runId, status)─┘              │              │              │
 │                    │<──────(result)──┘                    │              │              │              │
 │<─200 OK, {runId}───┤                 │                    │              │              │              │
```

### 9.3 Detailed Flow Steps

**Step 1: Initialize Run**
```typescript
const runId = await this.tracePort.createRun(agent.id, model);
const messages: Message[] = [{ role: 'user', content: userMessage }];
```

**Step 2: Generate Response**
```typescript
const response = await this.modelPort.generate({
  systemPrompt: agent.systemPrompt,
  messages,
  tools: this.getAvailableTools(agent.allowedTools),
  temperature: agent.temperature
});
```

**Step 3: Log Turn**
```typescript
await this.tracePort.appendTurn(runId, {
  role: 'assistant',
  content: response.content,
  toolCalls: response.toolCalls
});
```

**Step 4: Execute Tools (if any)**
```typescript
if (response.toolCalls && response.toolCalls.length > 0) {
  for (const call of response.toolCalls) {
    // Security check
    if (!agent.allowedTools.includes(call.name)) {
      throw new ToolNotAllowedError(call.name, agent.id);
    }

    // Execute
    const result = await this.toolPort.execute(call.name, call.parameters);

    // Log
    await this.tracePort.logToolExecution(runId, {
      toolName: call.name,
      input: call.parameters,
      output: result.output,
      success: result.success,
      executionTime: result.executionTime
    });

    // Add to conversation
    messages.push({
      role: 'tool',
      content: JSON.stringify(result.output)
    });
  }

  // Continue loop with updated messages
  continue;
}
```

**Step 5: Complete Run**
```typescript
await this.tracePort.completeRun(runId, 'completed');
return { runId, status: 'completed' };
```

### 9.4 Loop Termination Conditions

1. **Natural completion**: LLM returns response with `finishReason: 'stop'` and no tool calls
2. **Max turns reached**: Loop executes 10 times (configurable)
3. **Error**: Tool execution fails or model error
4. **Token limit**: Model reaches max token limit

---

## 10. Security Architecture

### 10.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| **Path Traversal** | File tool validates all paths stay within workspace |
| **Command Injection** | Shell tool runs in isolated temp dir, basic command validation |
| **Unauthorized Tool Access** | Per-agent allowlist enforced at runtime |
| **API Key Leakage** | Keys stored in `.env.local`, never logged or returned in responses |
| **Prompt Injection** | System prompt and user input clearly separated (LLM-level defense) |
| **Resource Exhaustion** | Tool timeouts (30s), max output buffers (1MB), max loop turns (10) |

### 10.2 Security Layers

**Layer 1: Configuration (Agent Definition)**
```typescript
agent.allowedTools = ['http', 'file']; // 'shell' explicitly excluded
```

**Layer 2: Runtime Validation (Execution Service)**
```typescript
if (!agent.allowedTools.includes(toolName)) {
  throw new ToolNotAllowedError(toolName, agent.id);
}
```

**Layer 3: Tool Sandboxing (Tool Implementation)**
```typescript
// File tool
const safePath = path.join(this.workspaceDir, params.path);
if (!safePath.startsWith(this.workspaceDir)) {
  throw new Error('Path traversal not allowed');
}

// Shell tool
if (command.includes('rm -rf /') || command.includes('sudo')) {
  throw new Error('Command not allowed');
}
const result = await execAsync(command, { cwd: this.tempDir, timeout: 30000 });
```

**Layer 4: Network Isolation**
- Local models run on localhost:11434 (no external network)
- Remote models require explicit API key configuration
- HTTP tool has timeout and size limits

### 10.3 Environment Variables

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Database
DATABASE_PATH=./data/agents.db

# Workspace
WORKSPACE_DIR=./workspace
```

**Security Rules:**
- Never commit `.env.local` to version control
- Never log or return API keys in responses
- Never send API keys to client

---

## 11. Data Persistence

### 11.1 Database: SQLite

**Why SQLite:**
- Local-first: No server setup required
- Single file database: Easy backup and migration
- ACID transactions: Data integrity
- Sufficient performance for local use

### 11.2 Schema

**Tables:**
1. `agents` - Agent configurations
2. `run_logs` - Execution history
3. `model_metadata` - Model performance tracking

**Relationships:**
- `run_logs.agentId` → `agents.id` (foreign key)

### 11.3 Migrations

**Initial Schema:**
```sql
-- agents table
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  default_model TEXT NOT NULL,
  allowed_tools TEXT NOT NULL,
  tags TEXT NOT NULL,
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- run_logs table
CREATE TABLE run_logs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  turns TEXT NOT NULL,
  tool_executions TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- model_metadata table
CREATE TABLE model_metadata (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  context_window INTEGER,
  max_output_tokens INTEGER,
  cost_input REAL,
  cost_output REAL,
  speed REAL,
  strengths TEXT,
  last_used INTEGER
);

-- Indexes
CREATE INDEX idx_run_logs_agent_id ON run_logs(agent_id);
CREATE INDEX idx_run_logs_created_at ON run_logs(created_at DESC);
```

### 11.4 Drizzle ORM Configuration

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/infrastructure/adapters/persistence/schema.ts',
  out: './drizzle',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: './data/agents.db'
  }
} satisfies Config;
```

**Commands:**
```bash
npx drizzle-kit generate:sqlite  # Generate migrations
npx drizzle-kit push:sqlite      # Apply migrations
npx drizzle-kit studio           # View database in browser
```

---

## 12. API Design

### 12.1 REST API Specification

| Endpoint | Method | Request Body | Response | Description |
|----------|--------|--------------|----------|-------------|
| `/api/agents` | GET | - | `Agent[]` | List all agents |
| `/api/agents` | POST | `CreateAgentDto` | `Agent` | Create new agent |
| `/api/agents?id={id}` | PUT | `Partial<Agent>` | `Agent` | Update agent |
| `/api/agents?id={id}` | DELETE | - | `{ success: true }` | Delete agent |
| `/api/run` | POST | `ExecuteAgentRequest` | `ExecuteAgentResponse` or SSE stream | Execute agent |
| `/api/models` | GET | - | `ModelInfo[]` | List available models |
| `/api/tools` | GET | - | `ToolDefinition[]` | List registered tools |
| `/api/runs?agentId={id}&limit={n}` | GET | - | `RunLog[]` | Get run history |
| `/api/runs/{runId}` | GET | - | `RunLog` | Get run details |

### 12.2 Request/Response Examples

#### Create Agent

**Request:**
```http
POST /api/agents
Content-Type: application/json

{
  "name": "Code Assistant",
  "description": "Helps with coding tasks",
  "systemPrompt": "You are an expert programmer. Help users write clean, efficient code.",
  "defaultModel": "ollama/codellama",
  "allowedTools": ["file", "shell"],
  "tags": ["coding", "development"],
  "temperature": 0.3,
  "maxTokens": 4096
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Code Assistant",
  "description": "Helps with coding tasks",
  "systemPrompt": "You are an expert programmer...",
  "defaultModel": "ollama/codellama",
  "allowedTools": ["file", "shell"],
  "tags": ["coding", "development"],
  "temperature": 0.3,
  "maxTokens": 4096,
  "createdAt": "2025-11-22T10:00:00Z",
  "updatedAt": "2025-11-22T10:00:00Z"
}
```

#### Execute Agent (Streaming)

**Request:**
```http
POST /api/run
Content-Type: application/json

{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Read the README.md file and summarize it",
  "stream": true
}
```

**Response (SSE):**
```
data: {"type":"start","runId":"abc-123"}

data: {"type":"content","delta":"I'll read"}

data: {"type":"content","delta":" the README"}

data: {"type":"tool_call","name":"file","parameters":{"operation":"read","path":"README.md"}}

data: {"type":"tool_result","output":{"content":"# My Project..."}}

data: {"type":"content","delta":"The README describes..."}

data: [DONE]
```

#### List Models

**Response:**
```json
[
  {
    "id": "ollama/codellama",
    "provider": "ollama",
    "name": "codellama",
    "displayName": "Code Llama",
    "contextWindow": 16384,
    "speed": 45.3,
    "lastUsed": "2025-11-22T09:30:00Z"
  },
  {
    "id": "openrouter/anthropic/claude-3.5-sonnet",
    "provider": "openrouter",
    "name": "anthropic/claude-3.5-sonnet",
    "displayName": "Claude 3.5 Sonnet",
    "contextWindow": 200000,
    "maxOutputTokens": 8192,
    "cost": { "input": 3, "output": 15 },
    "strengths": ["coding", "analysis", "tool-use"]
  }
]
```

### 12.3 Error Handling

**Standard Error Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid agent configuration",
    "details": [
      "System prompt is required",
      "Invalid tool: unknown_tool"
    ]
  }
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Validation error
- `404` - Resource not found
- `500` - Internal server error

---

## 13. Streaming Architecture

### 13.1 Server-Sent Events (SSE)

**Why SSE:**
- Simple HTTP-based protocol
- Native browser support (`EventSource` API)
- One-way server→client streaming (sufficient for LLM responses)
- Automatic reconnection

**Alternatives considered:**
- WebSockets: Bidirectional, but overkill for this use case
- Long polling: Inefficient, high latency

### 13.2 SSE Implementation

**Server (Next.js Route Handler):**
```typescript
export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send start event
      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'start', runId: 'abc-123' })}\n\n`
      ));

      // Stream LLM response
      for await (const chunk of modelPort.streamGenerate(request)) {
        if (chunk.content) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'content', delta: chunk.content })}\n\n`
          ));
        }

        if (chunk.toolCall) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'tool_call', ...chunk.toolCall })}\n\n`
          ));

          // Execute tool
          const result = await toolPort.execute(chunk.toolCall.name, chunk.toolCall.parameters);

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'tool_result', output: result.output })}\n\n`
          ));
        }
      }

      // Send completion event
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

**Client (React):**
```typescript
const [messages, setMessages] = useState([]);

const handleSend = async (message: string) => {
  const eventSource = new EventSource(
    `/api/run?agentId=${agentId}&message=${encodeURIComponent(message)}&stream=true`
  );

  eventSource.onmessage = (event) => {
    if (event.data === '[DONE]') {
      eventSource.close();
      return;
    }

    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'start':
        setCurrentRunId(data.runId);
        break;

      case 'content':
        setMessages(prev => appendContent(prev, data.delta));
        break;

      case 'tool_call':
        setMessages(prev => [...prev, { type: 'tool', name: data.name, status: 'running' }]);
        break;

      case 'tool_result':
        setMessages(prev => updateToolResult(prev, data.output));
        break;
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
    eventSource.close();
  };
};
```

### 13.3 Event Types

| Event Type | Payload | Description |
|------------|---------|-------------|
| `start` | `{ runId: string }` | Execution started |
| `content` | `{ delta: string }` | Incremental text content |
| `tool_call` | `{ name: string, parameters: any }` | Tool being called |
| `tool_result` | `{ output: any }` | Tool execution result |
| `error` | `{ message: string }` | Error occurred |
| `[DONE]` | - | Execution complete |

---

## 14. Error Handling

### 14.1 Error Hierarchy

```
Error
├── DomainError (domain layer)
│   ├── AgentNotFoundError
│   ├── ToolNotAllowedError
│   ├── ValidationError
│   └── ModelProviderError
│
├── InfrastructureError (infrastructure layer)
│   ├── DatabaseError
│   ├── NetworkError
│   └── ToolExecutionError
│
└── ApplicationError (application layer)
    ├── UseCaseError
    └── ConfigurationError
```

### 14.2 Error Handling Strategy

**Domain Layer:**
```typescript
// Throw domain-specific exceptions
throw new ToolNotAllowedError(toolName, agentId);
```

**Application Layer:**
```typescript
try {
  return await this.agentPort.create(dto);
} catch (error) {
  if (error instanceof DomainError) {
    // Expected domain error - log and rethrow
    logger.warn('Domain error:', error);
    throw error;
  }

  // Unexpected error - wrap and throw
  throw new UseCaseError('Failed to create agent', error);
}
```

**Presentation Layer:**
```typescript
export async function POST(request: Request) {
  try {
    const result = await useCase.execute(body);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: error.toJSON() }, { status: 400 });
    }

    if (error instanceof AgentNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    // Log unexpected errors
    logger.error('Unexpected error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 14.3 Logging Strategy

**Levels:**
- `ERROR` - Unexpected errors, system failures
- `WARN` - Expected errors (validation, not found), recoverable issues
- `INFO` - Normal operations (agent created, run completed)
- `DEBUG` - Detailed execution traces (development only)

**What to Log:**
- All API requests/responses (INFO)
- Domain errors (WARN)
- Infrastructure errors (ERROR)
- Tool executions (DEBUG)
- Model API calls (DEBUG)

**What NOT to Log:**
- API keys
- User prompts (unless explicitly enabled for debugging)
- Full model responses (too verbose)

---

## 15. Testing Strategy

### 15.1 Testing Pyramid

```
       ┌─────────────┐
       │   E2E (5%)   │  Full user flows
       ├─────────────┤
       │ Integration │   Adapter + real systems
       │   (20%)     │
       ├─────────────┤
       │             │
       │  Unit (75%) │   Domain services, validation
       │             │
       └─────────────┘
```

### 15.2 Unit Tests

**What to Test:**
- Domain services (mock all ports)
- Validation logic
- Business rules
- Error handling

**Example:**
```typescript
// agent-execution.service.test.ts
describe('AgentExecutionService', () => {
  let service: AgentExecutionService;
  let mockModelPort: MockModelPort;
  let mockToolPort: MockToolPort;
  let mockTracePort: MockTracePort;

  beforeEach(() => {
    mockModelPort = new MockModelPort();
    mockToolPort = new MockToolPort();
    mockTracePort = new MockTracePort();
    service = new AgentExecutionService(mockModelPort, mockToolPort, mockTracePort);
  });

  it('should execute agent without tool calls', async () => {
    mockModelPort.mockResponse({
      content: 'Hello!',
      finishReason: 'stop'
    });

    const agent = createTestAgent();
    const result = await service.executeAgentLoop(agent, 'Hi');

    expect(result.status).toBe('completed');
    expect(mockTracePort.runs[0].turns).toHaveLength(1);
  });

  it('should reject unauthorized tool calls', async () => {
    mockModelPort.mockResponse({
      content: '',
      toolCalls: [{ name: 'shell', parameters: {} }],
      finishReason: 'tool_calls'
    });

    const agent = createTestAgent({ allowedTools: ['http'] }); // shell not allowed

    await expect(service.executeAgentLoop(agent, 'Run ls'))
      .rejects
      .toThrow(ToolNotAllowedError);
  });

  it('should execute authorized tools and continue loop', async () => {
    mockModelPort
      .mockResponse({
        toolCalls: [{ name: 'http', parameters: { url: 'https://api.example.com' } }],
        finishReason: 'tool_calls'
      })
      .mockResponse({
        content: 'The API returned...',
        finishReason: 'stop'
      });

    mockToolPort.mockToolResult('http', { data: 'test' });

    const agent = createTestAgent({ allowedTools: ['http'] });
    const result = await service.executeAgentLoop(agent, 'Fetch data');

    expect(result.status).toBe('completed');
    expect(mockToolPort.executions).toHaveLength(1);
    expect(mockTracePort.toolLogs).toHaveLength(1);
  });
});
```

### 15.3 Integration Tests

**What to Test:**
- Adapters with real systems
- Database operations
- Model API calls (with test credentials)
- Tool executions

**Example:**
```typescript
// sqlite-agent-repository.test.ts
describe('SQLiteAgentRepository (Integration)', () => {
  let db: DrizzleDB;
  let repository: SQLiteAgentRepository;

  beforeEach(() => {
    db = createTestDatabase(); // In-memory SQLite
    repository = new SQLiteAgentRepository(db);
  });

  it('should create and retrieve agent', async () => {
    const dto: CreateAgentDto = {
      name: 'Test Agent',
      description: 'Test',
      systemPrompt: 'You are a test',
      defaultModel: 'test/model',
      allowedTools: ['http']
    };

    const created = await repository.create(dto);
    const retrieved = await repository.findById(created.id);

    expect(retrieved).toEqual(created);
  });

  it('should handle concurrent creates', async () => {
    const creates = Array(10).fill(null).map((_, i) =>
      repository.create({ name: `Agent ${i}`, /* ... */ })
    );

    const agents = await Promise.all(creates);
    const ids = agents.map(a => a.id);

    expect(new Set(ids).size).toBe(10); // All unique
  });
});
```

### 15.4 End-to-End Tests

**What to Test:**
- Full user workflows via API
- UI interactions (with Playwright)

**Example:**
```typescript
// agent-workflow.e2e.test.ts
describe('Agent Workflow (E2E)', () => {
  it('should create agent, execute, and view history', async () => {
    // Create agent
    const createResponse = await fetch('http://localhost:3000/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Test Agent',
        systemPrompt: 'You are helpful',
        defaultModel: 'ollama/llama3.2',
        allowedTools: []
      })
    });
    const agent = await createResponse.json();

    // Execute agent
    const runResponse = await fetch('http://localhost:3000/api/run', {
      method: 'POST',
      body: JSON.stringify({
        agentId: agent.id,
        message: 'Hello!'
      })
    });
    const { runId } = await runResponse.json();

    // Get history
    const historyResponse = await fetch(`http://localhost:3000/api/runs?agentId=${agent.id}`);
    const history = await historyResponse.json();

    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(runId);
  });
});
```

### 15.5 Test Utilities

**Mock Implementations:**
```typescript
export class MockModelPort implements ModelPort {
  private responses: GenerateResponse[] = [];

  mockResponse(response: GenerateResponse) {
    this.responses.push(response);
    return this;
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    return this.responses.shift()!;
  }
}

export class MockToolPort implements ToolPort {
  public executions: Array<{ name: string; params: any }> = [];
  private results = new Map<string, any>();

  mockToolResult(name: string, output: any) {
    this.results.set(name, output);
  }

  async execute(name: string, params: any): Promise<ToolExecutionResult> {
    this.executions.push({ name, params });
    return {
      success: true,
      output: this.results.get(name),
      executionTime: 100
    };
  }
}
```

---

## 16. Extension Points

### 16.1 Adding a New Model Provider

**Steps:**
1. Create adapter implementing `ModelPort`
2. Update `ModelFactory` to recognize provider
3. Update `ModelRegistryService` to discover models
4. Add API key to `.env.local`

**Example: Adding Cohere**
```typescript
// 1. Create adapter
export class CohereAdapter implements ModelPort {
  constructor(
    private modelName: string,
    private apiKey: string
  ) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // Call Cohere API
  }
}

// 2. Update factory
export class ModelFactory {
  static create(modelId: string): ModelPort {
    const [provider, model] = modelId.split('/');

    switch (provider) {
      // ... existing cases ...
      case 'cohere':
        return new CohereAdapter(model, process.env.COHERE_API_KEY);
    }
  }
}

// 3. Update registry
async refreshAvailableModels() {
  // ... existing code ...

  // Add Cohere models
  if (process.env.COHERE_API_KEY) {
    this.models.push({
      id: 'cohere/command-r-plus',
      provider: 'cohere',
      name: 'command-r-plus',
      displayName: 'Command R+',
      contextWindow: 128000
    });
  }
}
```

### 16.2 Adding a New Tool

**Steps:**
1. Implement `Tool` interface
2. Register in `DependencyContainer`

**Example: Adding a Search Tool**
```typescript
// 1. Implement tool
export class WebSearchTool implements Tool {
  name = 'web_search';
  description = 'Search the web using Brave Search API';
  parameters = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      count: { type: 'number', default: 5 }
    },
    required: ['query']
  };

  constructor(private apiKey: string) {}

  async run(params: { query: string; count?: number }): Promise<any> {
    const response = await fetch('https://api.search.brave.com/res/v1/web/search', {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': this.apiKey
      },
      params: {
        q: params.query,
        count: params.count || 5
      }
    });

    const data = await response.json();
    return {
      results: data.web.results.map(r => ({
        title: r.title,
        url: r.url,
        description: r.description
      }))
    };
  }
}

// 2. Register in bootstrap.ts
this.toolPort.register(new WebSearchTool(process.env.BRAVE_API_KEY));
```

### 16.3 Adding a New Persistence Layer

**Example: Replacing SQLite with PostgreSQL**

```typescript
// 1. Create Postgres adapter
export class PostgresAgentRepository implements AgentPort {
  constructor(private pool: pg.Pool) {}

  async create(dto: CreateAgentDto): Promise<Agent> {
    const result = await this.pool.query(
      'INSERT INTO agents (...) VALUES (...) RETURNING *',
      [...]
    );
    return this.mapRow(result.rows[0]);
  }

  // ... implement other methods
}

// 2. Update bootstrap.ts
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
this.agentPort = new PostgresAgentRepository(pool);

// Domain and application layers remain unchanged!
```

### 16.4 Adding Streaming Model Support

```typescript
// Model adapters can implement streaming
export class OllamaAdapter implements ModelPort {
  async *streamGenerate(request: GenerateRequest): AsyncIterator<StreamChunk> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({ ...request, stream: true })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        const data = JSON.parse(line);

        if (data.message?.content) {
          yield {
            type: 'content',
            content: data.message.content
          };
        }

        if (data.message?.tool_calls) {
          yield {
            type: 'tool_call',
            toolCall: data.message.tool_calls[0]
          };
        }
      }
    }
  }
}
```

---

## 17. Non-Functional Requirements

### 17.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Page Load Time** | < 1s | First contentful paint |
| **Local Model Startup** | < 300ms | Time to first token |
| **API Response Time** | < 100ms | Non-streaming endpoints |
| **Tool Execution** | < 30s | Timeout |
| **Database Queries** | < 50ms | P95 latency |

### 17.2 Scalability

**v0 Scope:**
- Single user, single machine
- Up to 1000 agents
- Up to 100,000 run logs
- Local SQLite sufficient

**v1+ Considerations:**
- Multi-user: Add authentication, tenant isolation
- Cloud sync: Replicate database to cloud storage
- Horizontal scaling: Move to Postgres, add read replicas

### 17.3 Reliability

**Data Integrity:**
- ACID transactions for database writes
- Foreign key constraints enforced
- Automatic backups (SQLite file copy)

**Error Recovery:**
- Graceful degradation if Ollama unavailable (fallback to remote models)
- Tool execution failures don't crash agent loop
- SSE reconnection on network interruption

**Availability:**
- Local-first: No external dependencies for core functionality
- Remote models optional
- Offline mode: Use cached local models

### 17.4 Maintainability

**Code Quality:**
- TypeScript strict mode enabled
- ESLint + Prettier configured
- 100% port interfaces documented
- E2E test coverage for critical paths

**Extensibility:**
- Clear extension points documented
- Example implementations for common extensions
- Adapter pattern allows swapping implementations

### 17.5 Security (Summary)

See [Section 10](#10-security-architecture) for detailed security architecture.

**Key Requirements:**
- Tools sandboxed and allowlisted
- API keys in environment variables only
- No prompt injection vulnerabilities
- Resource limits enforced

---

## 18. Implementation Roadmap

### 18.1 Phase 1: Core Infrastructure (Week 1)

**Goals:** Establish architecture foundation

**Tasks:**
1. ✅ Initialize Next.js project with TypeScript
2. ✅ Set up Drizzle ORM with SQLite
3. ✅ Define port interfaces (`domain/ports/`)
4. ✅ Implement domain entities (`domain/entities/`)
5. ✅ Create domain services (`domain/services/`)
6. ✅ Set up dependency injection container (`infrastructure/config/bootstrap.ts`)

**Deliverables:**
- Project structure established
- Database schema created
- Core domain logic defined

### 18.2 Phase 2: Model Integration (Week 1-2)

**Goals:** Connect to LLM providers

**Tasks:**
1. ✅ Implement `OllamaAdapter` (local models)
2. ✅ Implement `OpenRouterAdapter` (remote models)
3. ✅ Create `ModelRegistryService`
4. ✅ Build `ModelFactory` for adapter selection
5. ✅ Test model adapters with real APIs

**Deliverables:**
- Working LLM integration
- Model discovery working
- Streaming responses functional

### 18.3 Phase 3: Tool System (Week 2)

**Goals:** Build secure tool execution

**Tasks:**
1. ✅ Implement `InMemoryToolRegistry`
2. ✅ Create `ShellTool` (sandboxed)
3. ✅ Create `HTTPTool`
4. ✅ Create `FileTool` (workspace-restricted)
5. ✅ Create `CodeExecutorTool`
6. ✅ Test tool security boundaries

**Deliverables:**
- All v0 tools implemented
- Security validated
- Tool execution traced

### 18.4 Phase 4: Agent Execution (Week 2-3)

**Goals:** Implement ReAct loop

**Tasks:**
1. ✅ Build `AgentExecutionService`
2. ✅ Implement ReAct loop with tool calls
3. ✅ Add execution tracing
4. ✅ Build `ExecuteAgentUseCase`
5. ✅ Test multi-turn conversations

**Deliverables:**
- Agents can execute with tools
- Full execution traces logged
- Error handling working

### 18.5 Phase 5: Persistence (Week 3)

**Goals:** Store agents and logs

**Tasks:**
1. ✅ Implement `SQLiteAgentRepository`
2. ✅ Implement `SQLiteTraceRepository`
3. ✅ Build CRUD use cases
4. ✅ Run Drizzle migrations
5. ✅ Test database operations

**Deliverables:**
- Agents persist across restarts
- Run history queryable
- Database schema validated

### 18.6 Phase 6: API Layer (Week 3-4)

**Goals:** Build REST endpoints

**Tasks:**
1. ✅ Create `/api/agents` routes
2. ✅ Create `/api/run` route (with SSE streaming)
3. ✅ Create `/api/models` route
4. ✅ Create `/api/tools` route
5. ✅ Create `/api/runs` route
6. ✅ Test API with Postman/curl

**Deliverables:**
- All v0 API endpoints working
- Streaming functional
- Error responses standardized

### 18.7 Phase 7: UI (Week 4-5)

**Goals:** Build user interface

**Tasks:**
1. ⬜ Set up Tailwind + ShadCN components
2. ⬜ Build agent list sidebar
3. ⬜ Build chat interface (with streaming)
4. ⬜ Build trace viewer panel
5. ⬜ Add agent create/edit forms
6. ⬜ Add model selector dropdown
7. ⬜ Implement light/dark mode

**Deliverables:**
- Functional web interface
- All CRUD operations accessible
- Real-time streaming working

### 18.8 Phase 8: Testing & Polish (Week 5-6)

**Goals:** Validate and refine

**Tasks:**
1. ⬜ Write unit tests (target 75% coverage)
2. ⬜ Write integration tests for adapters
3. ⬜ Write E2E tests for critical flows
4. ⬜ Performance profiling and optimization
5. ⬜ Security audit of tool sandboxing
6. ⬜ Documentation (README, API docs)

**Deliverables:**
- Test suite passing
- Performance targets met
- Security validated
- Documentation complete

### 18.9 Phase 9: v0 Launch (Week 6)

**Goals:** Ship v0

**Tasks:**
1. ⬜ Final integration testing
2. ⬜ Create demo agents (coding, planning, analysis)
3. ⬜ Record demo video
4. ⬜ Deploy locally
5. ⬜ Gather initial feedback

**Deliverables:**
- v0 feature-complete
- Ready for dogfooding
- Feedback loop established

---

## 19. Appendices

### 19.1 Glossary

| Term | Definition |
|------|------------|
| **Agent** | AI assistant configured with system prompt, model, and allowed tools |
| **Port** | Interface defining contract between domain and infrastructure |
| **Adapter** | Concrete implementation of a port interface |
| **Tool** | Function callable by LLM (shell, HTTP, file, etc.) |
| **Run** | Single execution instance of an agent |
| **Turn** | One exchange in a conversation (user→assistant→tool results) |
| **ReAct** | Pattern alternating between reasoning (LLM) and acting (tools) |
| **SSE** | Server-Sent Events, HTTP streaming protocol |
| **Drizzle** | TypeScript ORM for SQLite/Postgres |
| **Ollama** | Local LLM runtime (http://localhost:11434) |
| **OpenRouter** | Multi-provider LLM API gateway |

### 19.2 References

**Architecture Patterns:**
- [Hexagonal Architecture (Ports & Adapters)](https://alistair.cockburn.us/hexagonal-architecture/)
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)

**LLM Tool Use:**
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic Tool Use](https://docs.anthropic.com/en/docs/tool-use)
- [ReAct Pattern Paper](https://arxiv.org/abs/2210.03629)

**Technologies:**
- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)

### 19.3 Architecture Decision Records

#### ADR-001: Hexagonal Architecture

**Status:** Accepted
**Context:** Need extensible architecture for swapping LLM providers and tools
**Decision:** Adopt Ports & Adapters (Hexagonal Architecture)
**Consequences:**
- ✅ Easy to swap implementations
- ✅ Highly testable with mock adapters
- ✅ Clear boundaries between layers
- ❌ More upfront boilerplate
- ❌ Steeper learning curve for contributors

#### ADR-002: SQLite for Persistence

**Status:** Accepted
**Context:** Need local-first database for v0
**Decision:** Use SQLite with Drizzle ORM
**Consequences:**
- ✅ Zero-config, single-file database
- ✅ ACID guarantees
- ✅ Easy backup (copy file)
- ❌ No concurrent writes (acceptable for single user)
- ❌ Migration to Postgres needed for multi-user

#### ADR-003: SSE for Streaming

**Status:** Accepted
**Context:** Need real-time streaming of LLM responses
**Decision:** Use Server-Sent Events (SSE) instead of WebSockets
**Consequences:**
- ✅ Simple HTTP-based protocol
- ✅ Native browser support (`EventSource`)
- ✅ Sufficient for one-way streaming
- ❌ No bidirectional communication (not needed)
- ❌ Potential reconnection issues on poor networks

#### ADR-004: In-Memory Tool Registry

**Status:** Accepted
**Context:** Need to register and discover tools
**Decision:** Use in-memory registry, tools register at startup
**Consequences:**
- ✅ Fast lookup (no DB queries)
- ✅ Simple implementation
- ✅ Tools can be dynamically loaded
- ❌ Registry reset on server restart (acceptable - tools are stateless)
- ❌ No persistent tool configuration (tools configured in code)

#### ADR-005: Per-Agent Tool Allowlist

**Status:** Accepted
**Context:** Need security model for tool access
**Decision:** Agents declare allowed tools, enforced at runtime
**Consequences:**
- ✅ Clear security boundary
- ✅ Prevents unauthorized tool access
- ✅ Auditable (logged in trace)
- ❌ Requires manual configuration per agent
- ❌ No dynamic permission escalation (deliberate security choice)

---

## 20. Document Metadata

**Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-22 | Claude (Software Architect Agent) | Initial TDD creation |

**Review Status:**
- [ ] Technical Review
- [ ] Security Review
- [ ] Implementation Feasibility
- [ ] Stakeholder Approval

**Next Steps:**
1. Review and approve TDD
2. Begin Phase 1 implementation
3. Set up CI/CD pipeline
4. Create project tracking board

---

## Conclusion

This Technical Design Document defines a **production-ready, extensible architecture** for the Local Agent Builder & Runner application. The strict adherence to **Ports & Adapters (Hexagonal Architecture)** ensures:

1. **Modularity**: Each layer has clear responsibilities
2. **Testability**: All components can be tested in isolation
3. **Extensibility**: New providers/tools added with minimal code changes
4. **Maintainability**: Business logic independent of frameworks

The architecture is designed for **long-term evolution**, anticipating:
- Additional model providers (Cohere, Gemini, etc.)
- New tool types (database queries, API integrations)
- Migration to multi-user (Postgres, authentication)
- Cloud deployment (containerization, horizontal scaling)

By following this design, the implementation will result in a **robust, secure, and maintainable system** that serves as a foundation for rapid agent prototyping and experimentation.

---

**For detailed implementation files, see:**
- `architecture/ports.ts` - Complete port interface definitions
- `architecture/adapters.ts` - Reference adapter implementations
- `architecture/schema.ts` - Database schema with Drizzle
- `architecture/bootstrap.ts` - Dependency injection container
- `architecture/ARCHITECTURE.md` - Extended technical documentation
- `architecture/api-routes.md` - REST API specification

**Implementation Status:** Ready to Begin
**Estimated Effort:** 6 weeks (single developer)
**Risk Level:** Low (well-defined architecture, proven patterns)
