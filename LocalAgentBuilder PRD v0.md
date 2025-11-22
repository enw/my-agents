
# PRD — Local Agent Builder & Runner (v0)

*A minimalist Next.js tool for building, testing, and interacting with tool-using agents.*

## 1. Purpose

A local-first environment to **create, run, and iterate on AI agents** (planning, architecture, coding, design, analysis, research, decision support). The tool should:

- Run **locally**, with local models (Ollama) preferred.
- Seamlessly fall back to **remote models** (OpenRouter, OpenAI, Anthropic).
- Support **tool-using agents** (shell, HTTP, FS, code execution, custom tools).
- Provide a **simple, clean UI** to build agents, run them, inspect reasoning, and test tools.
- Track **which models are best for which task** and eventually auto-select.

## 2. Users

### Primary User

- Technical founder (you): needs to rapidly prototype agents, test ideas, automate tasks, and evaluate different agent architectures.

### Secondary Users (future)

- Designers, analysts, researchers, junior developers needing structured automation.

## 3. Core User Problems

1. **Need a unified environment** to build and test agents.
2. **Switching between local/remote models is fragmented**.
3. **Unclear which model is best for which job**.
4. **Tool integration varies across agent frameworks**.
5. **LLM workflows need repeatability, introspection, and versioning**.

## 4. Product Goals

### v0 Goals

- Build a **local web interface** to:
    - Create/edit agent definitions
    - Run agents interactively
    - View intermediate reasoning (traces/logs)
    - Register tools and run them securely
- Provide **local+remote model routing** with manual selection.
- Store metadata about models (speed, cost, strengths).
- Use a **ports & adapters architecture** to remain extensible.

### Non-Goals (v0)

- Automatic model selection (record metadata now; use later).
- Multi-user/team collaboration.
- Long-running background agents.
- Cloud sync or cloud execution.
- Complex vector search/RAG pipelines.

## 5. System Overview

### 5.1 High-Level Workflow

1. **User defines an agent:**
    - Name
    - Description
    - Tools allowed
    - Default model
    - System prompt / Behavior config
2. **User interacts with the agent via:**
    - Chat console
    - Tasks / goal setting
    - Tool invocation logs
3. **Backend executes the agent using:**
    - Local model (Ollama)
    - Remote model (OpenRouter)
    - Tool invocation router
    - Persistent logs
4. **Results returned to UI in real time.**

## 6. Functional Requirements

### 6.1 Agent Management

- Create/update/delete agent profiles.
- Each agent must include:
    - `system_prompt`
    - `default_model`
    - `allowed_tools`
    - `temperature/top_p/max_tokens`
    - `memory toggle` (v1; stub metadata only in v0)
    - `tags` (planning, coding, analysis, etc.)
- Agents are stored locally (SQLite, JSON, or Postgres-lite recommended).

### 6.2 Model Management

- Detect installed **Ollama** models (`ollama list`).
- Connect to **OpenRouter** via API key.
- Manual model selection drop-down.
- Store metadata:
    - avg latency
    - cost (remote only)
    - model quality notes (manual for now)
- Provide a visual "model card" view.

### 6.3 Agent Execution

- Local chat-like interface.
- Streaming responses.
- Show reasoning steps (if model supports):
    - OpenAI: `response_format: "json_schema"` (optional)
    - Anthropic: "thinking" (optional)
    - Custom trace mode (log all tool calls)
- Task Mode (v1):
    - "Do X for me"
    - "Plan how to do Y"

### 6.4 Tools System (v0)

- Tools implement a **standard interface**:

    ```typescript
    interface Tool {
      name: string;
      description: string;
      parameters: JSONSchemaType<any>;
      run(params): Promise<any>;
    }
    ```

- Built-in tools (v0):
    - **Shell command runner** (sandboxed)
    - **HTTP fetch**
    - **File read/write** (restricted to workspace dir)
    - **Search** (BraveSearch/OpenRouter tool)
    - **Code executor (py/js)**
- Tool usage:
    - Agents declare allowed tools.
    - Model must output tool calls in structured format.

### 6.5 Logging & Observability

- Per-run log:
    - Model used
    - Prompt
    - Tokens used
    - Tool calls
    - Results
- Per-agent history.
- Basic tagging: "planning", "coding", "analysis", etc.

### 6.6 Minimalist UI Requirements

- Sidebar: list of agents
- Main panel: chat interface
- Right panel: logs, metadata, tool traces
- Light/dark mode

## 7. Architecture (Ports & Adapters)

### 7.1 Ports (Interfaces)

1. **ModelPort**
    - `generate(prompt, settings)`
    - Implementations:
        - `OllamaModelAdapter`
        - `OpenRouterModelAdapter`
2. **ToolPort**
    - A registry where tools self-register.
3. **AgentPort**
    - CRUD interface for agent configs.
4. **TracePort**
    - Append/query logs.

### 7.2 Adapters

#### Model Adapters

- Ollama: call local `http://localhost:11434/api/generate`
- OpenRouter: call REST endpoint with API key

#### Tool Adapters

- Shell execution (restricted)
- HTTP fetch
- FS access

#### Storage Adapter

- SQLite (preferred) or local JSON (simplest)
- Drizzle or Prisma for schema

## 8. Data Model (v0)

### 8.1 Agent

```typescript
interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  defaultModel: string;
  allowedTools: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 8.2 Model Metadata

```typescript
interface ModelInfo {
  id: string;
  provider: "ollama" | "openrouter";
  name: string;
  size?: string;
  speed?: number;
  cost?: number;
  strengths?: string[];
  lastUsed?: string;
}
```

### 8.3 Logs

```typescript
interface RunLog {
  id: string;
  agentId: string;
  model: string;
  userMessage: string;
  response: string;
  toolCalls: ToolCall[];
  tokens: { input: number; output: number };
  createdAt: string;
}
```

## 9. API Endpoints (Next.js Route Handlers)

### `/api/agents`

- `GET` — List agents
- `POST` — Create agent
- `PUT` — Update agent
- `DELETE` — Remove agent

### `/api/run`

- `POST`:
    - `agentId`
    - `input` (text)
    - `streaming = true`

### `/api/model/list`

- `GET` — Local + remote models

### `/api/tools/list`

- `GET` — Registered tools

## 10. Tech Stack

### Frontend

- Next.js (App Router)
- TypeScript
- Tailwind/ShadCN
- React Query for async state
- SSE or WebSockets for streaming

### Backend

- Next.js server actions + route handlers
- Ports & Adapters pattern
- SQLite (Drizzle ORM)

### LLM Providers

- **Ollama** (local)
- **OpenRouter** (remote, including Anthropic, OpenAI, Google, Mistral, Qwen, etc.)

## 11. Security Requirements (v0)

- Tools must be opt-in per agent.
- Shell tool must:
    - Whitelist commands **OR**
    - Run in sandboxed temp dir
- File tool restricted to workspace directory.
- No remote upload of user prompts by default (unless remote model chosen)
- `.env.local` for API keys.

## 12. Performance Requirements

- Chat responses stream within <300 ms startup (local)
- Page must load in <1 s
- Tool invocation latency recorded

## 13. Future Extensions (v1+)

- Automatic model selection based on logged metadata.
- Multi-agent workflows.
- Built-in RAG workspace.
- Local embedding search.
- Project-level agent memories.
- Visual agent chain builder.
- Offline-only mode.

## 14. Acceptance Criteria (v0)

- I can create/edit/delete agents.
- I can choose a model for each run.
- I can run the agent and see streaming output.
- I can view all tool calls for a run.
- I can configure which tools an agent may call.
- I can view model metadata.
- All functionality runs locally except remote model calls.

