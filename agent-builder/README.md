# Local Agent Builder & Runner

A minimalist Next.js application for building, testing, and interacting with tool-using AI agents locally. Supports both local models (Ollama) and remote models (OpenRouter, OpenAI, Anthropic) with a unified interface.

## Features

- **Local-First Architecture**: Run entirely on your machine with local models via Ollama
- **Multi-Provider Support**: Seamlessly switch between Ollama, OpenRouter, OpenAI, and Anthropic
- **Tool System**: Built-in tools for shell commands, HTTP requests, file operations, and code execution
- **Hexagonal Architecture**: Clean separation of concerns with ports & adapters pattern
- **Agent Management**: Create, edit, and manage multiple agent configurations
- **Execution Tracing**: Detailed logs of agent runs, tool calls, and token usage
- **Security**: Sandboxed tool execution with per-agent allowlisting

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

# Database
DATABASE_PATH=./data/agents.db

# Workspace (for file tool)
WORKSPACE_DIR=./workspace

# Ollama (optional)
OLLAMA_BASE_URL=http://localhost:11434
```

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

### 1. Shell Tool

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

### 2. HTTP Tool

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

### 3. File Tool

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

### 4. Code Executor Tool

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
2. Register in `DependencyContainer` in `infrastructure/config/bootstrap.ts`

**Example:**
```typescript
// infrastructure/adapters/tools/search.tool.ts
export class SearchTool implements Tool {
  name = 'web_search';
  description = 'Search the web';

  async run(params: { query: string }) {
    // Call search API
  }
}

// Register in bootstrap.ts
this.toolPort.register(new SearchTool());
```

## Roadmap

### v0 (Current)

- ✅ Agent management (CRUD)
- ✅ Model abstraction (Ollama, OpenRouter, OpenAI, Anthropic)
- ✅ Tool system (Shell, HTTP, File, Code Executor)
- ✅ Execution tracing
- ⏳ UI for agent management and chat interface

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

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Database with [Drizzle ORM](https://orm.drizzle.team/)
- Local models via [Ollama](https://ollama.ai)
- Remote models via [OpenRouter](https://openrouter.ai)
- Architecture inspired by [Hexagonal Architecture (Ports & Adapters)](https://alistair.cockburn.us/hexagonal-architecture/)

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Built with Claude Code** 🤖
