# Local Agent Builder & Runner

A minimalist Next.js application for building, testing, and interacting with tool-using AI agents locally. Supports both local models (Ollama) and remote models (OpenRouter, OpenAI, Anthropic) with a unified interface.

## Features

- **Local-First Architecture**: Run entirely on your machine with local models via Ollama
- **Multi-Provider Support**: Seamlessly switch between Ollama, OpenRouter, OpenAI, and Anthropic
- **Tool System**: Built-in tools for shell commands, HTTP requests, file operations, web search, Wikipedia, and code execution
- **Hexagonal Architecture**: Clean separation of concerns with ports & adapters pattern
- **Agent Management**: Create, edit, fork, and manage multiple agent configurations with templates
- **Execution Tracing**: Detailed logs of agent runs, tool calls, and token usage with cost tracking
- **Security**: Sandboxed tool execution with per-agent allowlisting
- **Blueberg Lite UI**: Dense, terminal-inspired interface optimized for power users
- **Command System**: Powerful `/` commands for navigation, model switching, and advanced features
- **Command Palette**: Quick access to commands, conversations, and actions (Cmd+K / Ctrl+K)
- **Resizable Workspace**: 3-pane chat interface with resizable panels for conversations, messages, and trace viewer
- **Onboarding Flow**: Guided tour for new users with quick start templates

## Architecture

This project follows **Hexagonal Architecture (Ports & Adapters)** for maximum extensibility:

```
Presentation (Next.js) → Application (Use Cases) → Domain (Services + Ports) ← Infrastructure (Adapters)
```

### Key Design Principles

- **Dependency Inversion**: Core business logic is independent of frameworks and external services
- **Interface Segregation**: Focused port interfaces for each concern (models, tools, storage, tracing)
- **Security by Default**: Tools are opt-in per agent with sandboxed execution
- **Type Safety**: Full TypeScript coverage with strict mode

## Prerequisites

- **Node.js** 18+ (for Next.js)
- **Ollama** (optional, for local models) - [Install Ollama](https://ollama.ai)
- **SQLite** (included with Node.js)

## Quick Start

### 1. Installation

```bash
# Clone the repository
cd agent-builder

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local

# (Optional) Add API keys to .env.local for remote models
nano .env.local
```

### 2. Database Setup

The database schema is already applied, but you can regenerate migrations if needed:

```bash
# Generate new migrations (if schema changes)
npm run db:generate

# View database in browser
npm run db:studio
```

### 3. Start the Development Server

```bash
npm run dev
```

The application will be available at **http://localhost:3000**

### 4. (Optional) Install Ollama Models

For local model support:

```bash
# Install Ollama from https://ollama.ai

# Pull a model (e.g., Llama 3.2)
ollama pull llama3.2

# Pull a coding model
ollama pull codellama

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

## Configuration

### Environment Variables

Edit `.env.local` to configure:

```bash
# LLM Provider API Keys (optional)
OPENROUTER_API_KEY=sk-or-v1-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Web Search API Key (optional but recommended)
BRAVE_API_KEY=BSA_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Database
DATABASE_PATH=./data/agents.db

# Workspace (for file tool)
WORKSPACE_DIR=./workspace

# Ollama (optional)
OLLAMA_BASE_URL=http://localhost:11434
```

**Note**: The `BRAVE_API_KEY` enables high-quality web search via Brave Search API. Without it, the tool falls back to DuckDuckGo (free, no key required). See [Web Search Documentation](./docs/WEB_SEARCH.md) for details.

### Model Providers

#### 1. Ollama (Local)

- **Cost**: Free
- **Privacy**: Runs entirely on your machine
- **Setup**: Install Ollama and pull models
- **Model ID Format**: `ollama/model-name` (e.g., `ollama/llama3.2`)

#### 2. OpenRouter (Remote)

- **Cost**: Pay-per-use (varies by model)
- **Privacy**: Prompts sent to OpenRouter API
- **Setup**: Get API key from https://openrouter.ai
- **Model ID Format**: `openrouter/provider/model` (e.g., `openrouter/anthropic/claude-3.5-sonnet`)
- **Supports**: Anthropic, OpenAI, Google, Mistral, Qwen, DeepSeek, and more

#### 3. OpenAI (Direct)

- **Cost**: Pay-per-use
- **Setup**: Get API key from https://platform.openai.com
- **Model ID Format**: `openai/model-name` (e.g., `openai/gpt-4o`)

#### 4. Anthropic (Direct)

- **Cost**: Pay-per-use
- **Setup**: Get API key from https://console.anthropic.com
- **Model ID Format**: `anthropic/model-name` (e.g., `anthropic/claude-3-5-sonnet-20241022`)

## User Interface

### Dashboard

The main dashboard provides a dense table view of all your agents with:
- **Sortable columns**: Agent name, model, tools, tags, last run, version
- **Search & filters**: Quick search by name/description, filter by tags or providers
- **Quick actions**: Chat, edit, fork, or delete agents directly from the table
- **Compact design**: Blueberg Lite aesthetic with 30-32px row heights

### Chat Workspace

The chat interface features a 3-pane resizable layout:

1. **Left Panel (Conversations)**: 
   - List of all conversations for the current agent
   - Compact conversation cards with metadata (model, turns, timestamp)
   - "New Chat" button to start fresh conversations
   - Navigation controls for previous/next conversations

2. **Center Panel (Messages)**:
   - Chat messages with sender lines (Agent/You, timestamp, model)
   - Markdown rendering with syntax highlighting
   - "Jump to latest" button when scrolled up
   - Command input with autocomplete (type `/` to see commands)

3. **Right Panel (Tools/Trace)**:
   - **Trace tab**: Detailed execution trace with tool calls, token usage, costs
   - **Tools tab**: List of available tools for the agent
   - **Files tab**: File upload and management (coming soon)
   - **Notes tab**: Scratchpad for conversation notes

### Command System

The application includes a powerful command system accessible via `/`:

- **Navigation**: `/prev`, `/next`, `/latest`, `/goto <n>`
- **Model switching**: `/model <model-id>`
- **Trace viewer**: `/trace`, `/trace off`
- **Help**: `/help`, `/commands`
- **Conversation management**: `/export`, `/clear`

**Command Palette (Cmd+K / Ctrl+K)**:
- Search all commands with descriptions
- Browse recent conversations
- Quick actions (new chat, edit agent, dashboard)

### Agent Templates

Quick start with pre-configured agent templates:
- **General Assistant**: Basic tools, friendly tone
- **Code Assistant**: Python/TypeScript focused with code execution
- **Research Agent**: Web search + Wikipedia for research tasks
- **Data Analyst**: Data processing and analysis tools

### Onboarding

New users are guided through:
1. Creating their first agent
2. Starting a chat conversation
3. Using commands (type `/help`)

## Usage

### API Endpoints

#### Health Check

```bash
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "message": "Local Agent Builder API is running",
  "timestamp": "2025-11-22T10:00:00Z"
}
```

#### Create Agent

```bash
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

#### List Agents

```bash
GET /api/agents
```

#### Execute Agent

```bash
POST /api/run
Content-Type: application/json

{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Read the README.md file and summarize it",
  "stream": true
}
```

#### List Available Models

```bash
GET /api/models
```

#### List Available Tools

```bash
GET /api/tools
```

#### Get Run History

```bash
GET /api/runs?agentId=<agent-id>&limit=50
```

## Built-In Tools

### 1. Web Search Tool 🔍

Search the internet for real-time information. Supports Brave Search API (premium) with automatic fallback to DuckDuckGo (free).

**Features:**
- High-quality search results via Brave Search API
- Privacy-focused DuckDuckGo fallback (no API key required)
- Returns titles, URLs, and snippets
- Automatic provider fallback on errors

**Configuration:**
- Set `BRAVE_API_KEY` in `.env.local` for Brave Search
- Works without API key (uses DuckDuckGo)

**Example:**
```json
{
  "name": "web_search",
  "parameters": {
    "query": "latest AI developments",
    "numResults": 5
  }
}
```

**Documentation**: See [Web Search Documentation](./docs/WEB_SEARCH.md) for detailed setup and usage.

### 2. Shell Tool

Execute shell commands in a sandboxed temporary directory.

**Security:**
- Restricted to temporary directory
- 30-second timeout
- 1MB output buffer limit
- Basic command validation

**Example:**
```json
{
  "name": "shell",
  "parameters": {
    "command": "ls -la"
  }
}
```

### 3. HTTP Tool

Fetch data from HTTP endpoints.

**Security:**
- 10-second timeout
- Size limits
- No file system access

**Example:**
```json
{
  "name": "http",
  "parameters": {
    "url": "https://api.example.com/data",
    "method": "GET"
  }
}
```

### 4. File Tool

Read, write, and list files in the workspace directory.

**Security:**
- Restricted to workspace directory
- Path traversal prevention
- No access outside workspace

**Example:**
```json
{
  "name": "file",
  "parameters": {
    "operation": "read",
    "path": "README.md"
  }
}
```

### 5. Wikipedia Tool 📚

Search and retrieve Wikipedia articles with intelligent caching. Articles are cached for 7 days for fast subsequent access.

**Features:**
- Search Wikipedia articles
- Get full articles or summaries
- Automatic caching (7-day TTL)
- Fast cache retrieval

**Example:**
```json
{
  "name": "wikipedia",
  "parameters": {
    "query": "Artificial Intelligence",
    "action": "summary"
  }
}
```

**Documentation**: See [Wikipedia Tool Documentation](./docs/WIKIPEDIA_TOOL.md) for detailed usage.

### 6. Code Executor Tool

Execute Python or JavaScript code in a sandboxed environment.

**Security:**
- 30-second timeout
- Isolated execution
- No persistent state

**Example:**
```json
{
  "name": "execute_code",
  "parameters": {
    "language": "python",
    "code": "print('Hello, World!')"
  }
}
```

## Security Model

### Per-Agent Tool Allowlist

Agents must explicitly declare which tools they can use:

```typescript
{
  "allowedTools": ["http", "file"] // "shell" explicitly excluded
}
```

### Runtime Validation

Tool access is enforced at runtime. If an agent tries to call an unauthorized tool, the execution fails with a `ToolNotAllowedError`.

### Tool Sandboxing

- **Shell Tool**: Runs in isolated temp directory, basic command validation
- **File Tool**: Restricted to workspace directory, path traversal prevention
- **HTTP Tool**: Timeout and size limits
- **Code Executor**: Sandboxed execution with timeout

### API Key Security

- API keys stored in `.env.local` only
- Never logged or returned in API responses
- Not sent to client

## Project Structure

```
agent-builder/
├── app/                          # Next.js app directory (presentation layer)
│   ├── api/                      # API routes
│   │   ├── agents/
│   │   ├── run/
│   │   ├── models/
│   │   ├── tools/
│   │   └── runs/
│   ├── components/               # UI components
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── domain/                       # Business logic (no external deps)
│   ├── ports/                    # Interface definitions
│   ├── entities/                 # Domain models
│   ├── services/                 # Business logic
│   └── errors/                   # Domain exceptions
├── application/                  # Use cases (orchestration)
│   ├── use-cases/
│   └── dto/
├── infrastructure/               # External integrations
│   ├── adapters/
│   │   ├── models/               # LLM provider adapters
│   │   └── tools/                # Tool implementations
│   ├── persistence/              # Database schema & repositories
│   └── config/                   # Dependency injection
├── data/                         # SQLite database
│   └── agents.db
├── workspace/                    # File tool workspace
├── drizzle/                      # Database migrations
└── package.json
```

## Development

### Running Tests

```bash
# (Tests not yet implemented)
npm test
```

### Building for Production

```bash
npm run build
npm start
```

### Database Management

```bash
# Generate new migrations after schema changes
npm run db:generate

# Apply migrations
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

### Linting

```bash
npm run lint
```

## Extending the System

### Adding a New Model Provider

1. Create adapter implementing `ModelPort` in `infrastructure/adapters/models/`
2. Update `ModelFactory` in `infrastructure/config/bootstrap.ts`
3. Update `ModelRegistryService` to discover models
4. Add API key to `.env.local`

**Example:**
```typescript
// infrastructure/adapters/models/cohere.adapter.ts
export class CohereAdapter implements ModelPort {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // Call Cohere API
  }
}

// infrastructure/config/bootstrap.ts
case 'cohere':
  return new CohereAdapter(modelName, process.env.COHERE_API_KEY);
```

### Adding a New Tool

1. Implement `Tool` interface in `infrastructure/adapters/tools/`
2. Register in `createDefaultTools()` function in `infrastructure/adapters/tools/index.ts`

**Example:**
```typescript
// infrastructure/adapters/tools/custom.tool.ts
export class CustomTool implements Tool {
  name = 'custom_tool';
  description = 'Custom tool description';
  parameters: ToolParameterSchema = { /* ... */ };

  async execute(parameters: Record<string, unknown>): Promise<ToolResult> {
    // Tool implementation
  }
}

// Register in infrastructure/adapters/tools/index.ts
export function createDefaultTools(config: {...}): Tool[] {
  return [
    // ... other tools
    new CustomTool(),
  ];
}
```

**Note**: The `web_search` tool is already implemented with Brave Search support. See [Web Search Documentation](./docs/WEB_SEARCH.md) for details.

## Roadmap

### v0 (Current)

- ✅ Agent management (CRUD, fork, versioning)
- ✅ Model abstraction (Ollama, OpenRouter, OpenAI, Anthropic)
- ✅ Tool system (Shell, HTTP, File, Web Search, Wikipedia, Code Executor)
- ✅ Execution tracing with cost tracking
- ✅ Blueberg Lite UI with dense table views
- ✅ Chat workspace with resizable 3-pane layout
- ✅ Command system with autocomplete and palette
- ✅ Agent templates for quick start
- ✅ Onboarding flow for new users

### v1 (Future)

- Automatic model selection based on task and performance data
- Multi-agent workflows
- RAG/vector search integration
- Long-running background agents
- Cloud sync and collaboration
- Visual agent chain builder

## Troubleshooting

### "Ollama not available" error

**Solution:** Make sure Ollama is installed and running:
```bash
ollama serve
# In another terminal:
ollama pull llama3.2
```

### "API key not set" error

**Solution:** Add the required API key to `.env.local`:
```bash
cp .env.local.example .env.local
nano .env.local
```

**Note**: Most tools work without API keys. Only add keys for features you want to use:
- `BRAVE_API_KEY`: For premium web search (optional, falls back to DuckDuckGo)
- `OPENROUTER_API_KEY`: For remote models via OpenRouter
- `OPENAI_API_KEY`: For direct OpenAI API access
- `ANTHROPIC_API_KEY`: For direct Anthropic API access

### Database errors

**Solution:** Regenerate the database:
```bash
rm data/agents.db
sqlite3 data/agents.db < drizzle/0000_living_shard.sql
```

### Port 3000 already in use

**Solution:** Use a different port:
```bash
PORT=3001 npm run dev
```

## Contributing

This is a personal project, but contributions are welcome! Please:

1. Follow the hexagonal architecture pattern
2. Maintain type safety (strict TypeScript)
3. Add tests for new features
4. Update documentation

## License

ISC

## Documentation

- [Web Search Tool](./docs/WEB_SEARCH.md) - Comprehensive guide to web search functionality
- [Wikipedia Tool](./docs/WIKIPEDIA_TOOL.md) - Guide to Wikipedia search and caching
- [SME Agent Design](./docs/SME_AGENT_DESIGN.md) - Guide for creating Subject Matter Expert agents
- [SME Agent Implementation Status](./docs/SME_AGENT_IMPLEMENTATION_STATUS.md) - Current implementation status
- [UX Improvements Roadmap](./docs/UX_IMPROVEMENTS_ROADMAP.md) - Planned UX enhancements and current status
- [Design System](./docs/DESIGN_SYSTEM.md) - Blueberg Lite design tokens and component specifications

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Database with [Drizzle ORM](https://orm.drizzle.team/)
- Local models via [Ollama](https://ollama.ai)
- Remote models via [OpenRouter](https://openrouter.ai)
- Web search via [Brave Search API](https://brave.com/search/api/) and [DuckDuckGo](https://duckduckgo.com/)
- Architecture inspired by [Hexagonal Architecture (Ports & Adapters)](https://alistair.cockburn.us/hexagonal-architecture/)

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Built with Claude Code** 🤖
