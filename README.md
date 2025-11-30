# My Agents - Turborepo Monorepo

A monorepo for building and managing AI agents using Hexagonal Architecture (Ports & Adapters) pattern.

## Structure

```
my-agents/
├── apps/
│   └── agent-builder/          # Next.js application
├── packages/
│   ├── domain/                 # Domain layer (ports, entities, services)
│   ├── infrastructure/         # Infrastructure layer (adapters, persistence)
│   └── application/            # Application layer (use cases)
└── [config files]
```

## Packages

### `@my-agents/domain`
Core business logic with zero external dependencies. Contains:
- Port interfaces (ModelPort, AgentPort, ToolPort, etc.)
- Domain entities
- Domain services
- Domain errors

### `@my-agents/infrastructure`
Implements domain ports. Contains:
- Model adapters (Ollama, OpenRouter, etc.)
- Persistence adapters (SQLite repositories)
- Tool implementations
- Bootstrap/Dependency injection

### `@my-agents/application`
Orchestrates domain services. Contains:
- Use cases (CreateAgent, ExecuteAgent, etc.)
- Use case factory

### `apps/agent-builder`
Next.js application that uses all packages.

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development server
pnpm dev

# Run linting
pnpm lint
```

## Package Dependencies

```
apps/agent-builder
  └── @my-agents/application
      ├── @my-agents/domain
      └── @my-agents/infrastructure
          └── @my-agents/domain
```

## Development

This monorepo uses:
- **Turborepo** for build orchestration and caching
- **PNPM** for package management with workspaces
- **TypeScript** with project references for type safety




