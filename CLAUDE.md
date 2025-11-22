# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Local Agent Builder & Runner** - A minimalist Next.js application for building, testing, and interacting with tool-using AI agents locally. Supports both local models (Ollama) and remote models (OpenRouter, OpenAI, Anthropic) with a unified interface.

## Current Status

This is a **greenfield project**. Only the PRD exists - no code has been written yet. Reference `LocalAgentBuilder PRD v0.md` for complete functional requirements.

## Architecture Principles

### Ports & Adapters (Hexagonal Architecture)

The codebase must follow a strict ports & adapters pattern for extensibility:

**Core Ports:**
- `ModelPort` - Interface for LLM providers (`generate(prompt, settings)`)
- `ToolPort` - Registry where tools self-register
- `AgentPort` - CRUD interface for agent configurations
- `TracePort` - Append/query execution logs

**Adapters:**
- `OllamaModelAdapter` - Local model via http://localhost:11434/api/generate
- `OpenRouterModelAdapter` - Remote models via REST API
- Tool adapters: Shell (sandboxed), HTTP fetch, filesystem (workspace-restricted), code execution

### Tech Stack

**Frontend:**
- Next.js (App Router)
- TypeScript
- Tailwind + ShadCN components
- React Query for async state
- SSE or WebSockets for streaming responses

**Backend:**
- Next.js server actions + route handlers
- SQLite with Drizzle ORM
- Ports & Adapters pattern strictly enforced

## Core Data Models

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

interface Tool {
  name: string;
  description: string;
  parameters: JSONSchemaType<any>;
  run(params): Promise<any>;
}

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

## API Routes Structure

- `GET/POST/PUT/DELETE /api/agents` - Agent management
- `POST /api/run` - Execute agent with streaming support
- `GET /api/model/list` - Fetch local (Ollama) + remote models
- `GET /api/tools/list` - List registered tools

## Security Requirements

- Tools are **opt-in per agent** via `allowedTools` array
- Shell tool must run in sandboxed temp directory
- File tool restricted to workspace directory only
- API keys in `.env.local` only
- No remote upload of prompts unless remote model explicitly chosen

## Development Commands

When implementing:

**Setup (when created):**
```bash
npm install
# Configure Drizzle with SQLite
npx drizzle-kit generate:sqlite
npx drizzle-kit push:sqlite
```

**Development:**
```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run lint         # ESLint check
```

**Database:**
```bash
npx drizzle-kit studio    # View database
npx drizzle-kit push      # Apply schema changes
```

## Key Implementation Notes

1. **Model Detection:** Use `ollama list` to detect installed local models on startup
2. **Streaming:** Implement SSE for streaming LLM responses
3. **Tool Execution:** All tool calls must be logged in RunLog with results
4. **Workspace Isolation:** File and shell tools must never escape workspace directory
5. **Model Metadata:** Track latency, cost, and quality notes for future auto-selection (v1 feature)

## UI Layout

- **Sidebar:** List of agents (create/edit/delete)
- **Main Panel:** Chat interface with streaming responses
- **Right Panel:** Execution logs, tool traces, metadata
- Light/dark mode support

## Non-Goals for v0

Do not implement these in initial version:
- Automatic model selection (metadata collection only)
- Multi-user collaboration
- Long-running background agents
- Cloud sync or execution
- RAG/vector search pipelines
- Multi-agent workflows
