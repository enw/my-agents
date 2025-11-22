# API Routes Design
## Local Agent Builder & Runner

This document defines the REST API surface for the application.

---

## Design Principles

1. **RESTful conventions** - Standard HTTP methods (GET, POST, PUT, DELETE)
2. **JSON payloads** - All requests/responses use JSON
3. **Consistent error format** - Standardized error responses
4. **Streaming via SSE** - Server-Sent Events for real-time updates
5. **Type-safe** - All routes have TypeScript request/response types

---

## Agent Management

### Create Agent

```http
POST /api/agents
Content-Type: application/json

{
  "name": "Code Assistant",
  "description": "Helps with coding tasks",
  "systemPrompt": "You are a helpful coding assistant...",
  "defaultModel": "ollama:llama3.2",
  "allowedTools": ["file", "code_exec", "http"],
  "tags": ["coding", "development"]
}
```

**Response (201 Created):**

```json
{
  "id": "agent-uuid",
  "name": "Code Assistant",
  "description": "Helps with coding tasks",
  "systemPrompt": "You are a helpful coding assistant...",
  "defaultModel": "ollama:llama3.2",
  "allowedTools": ["file", "code_exec", "http"],
  "tags": ["coding", "development"],
  "createdAt": "2025-11-22T10:00:00.000Z",
  "updatedAt": "2025-11-22T10:00:00.000Z"
}
```

**Errors:**

- `400 Bad Request` - Validation error (missing fields, invalid model, etc.)
- `500 Internal Server Error` - Database error

---

### List Agents

```http
GET /api/agents?tags=coding&search=code&limit=20&offset=0
```

**Query Parameters:**

- `tags` (optional): Comma-separated tags to filter by
- `search` (optional): Search term (matches name/description)
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response (200 OK):**

```json
{
  "agents": [
    {
      "id": "agent-1",
      "name": "Code Assistant",
      "description": "Helps with coding tasks",
      "systemPrompt": "...",
      "defaultModel": "ollama:llama3.2",
      "allowedTools": ["file", "code_exec"],
      "tags": ["coding"],
      "createdAt": "2025-11-22T10:00:00.000Z",
      "updatedAt": "2025-11-22T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

### Get Agent

```http
GET /api/agents/:id
```

**Response (200 OK):**

```json
{
  "id": "agent-1",
  "name": "Code Assistant",
  "description": "Helps with coding tasks",
  "systemPrompt": "You are a helpful coding assistant...",
  "defaultModel": "ollama:llama3.2",
  "allowedTools": ["file", "code_exec", "http"],
  "tags": ["coding", "development"],
  "createdAt": "2025-11-22T10:00:00.000Z",
  "updatedAt": "2025-11-22T10:00:00.000Z"
}
```

**Errors:**

- `404 Not Found` - Agent doesn't exist

---

### Update Agent

```http
PUT /api/agents/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "allowedTools": ["file", "http", "shell"]
}
```

**Response (200 OK):**

```json
{
  "id": "agent-1",
  "name": "Updated Name",
  "description": "Helps with coding tasks",
  "systemPrompt": "You are a helpful coding assistant...",
  "defaultModel": "ollama:llama3.2",
  "allowedTools": ["file", "http", "shell"],
  "tags": ["coding", "development"],
  "createdAt": "2025-11-22T10:00:00.000Z",
  "updatedAt": "2025-11-22T10:30:00.000Z"
}
```

**Errors:**

- `404 Not Found` - Agent doesn't exist
- `400 Bad Request` - Validation error

---

### Delete Agent

```http
DELETE /api/agents/:id
```

**Response (204 No Content)**

**Errors:**

- `404 Not Found` - Agent doesn't exist

---

## Agent Execution

### Execute Agent (Non-Streaming)

```http
POST /api/run
Content-Type: application/json

{
  "agentId": "agent-1",
  "message": "Write a Python function to sort a list",
  "modelOverride": "openrouter:anthropic/claude-3.5-sonnet",
  "maxTurns": 5
}
```

**Response (200 OK):**

```json
{
  "runId": "run-uuid",
  "status": "completed",
  "response": "Here's a Python function to sort a list:\n\n```python\ndef sort_list(items):\n    return sorted(items)\n```"
}
```

**Errors:**

- `404 Not Found` - Agent doesn't exist
- `400 Bad Request` - Invalid model
- `500 Internal Server Error` - Execution error

---

### Execute Agent (Streaming)

```http
POST /api/run
Content-Type: application/json

{
  "agentId": "agent-1",
  "message": "Write a Python function to sort a list",
  "stream": true
}
```

**Response (200 OK):**

```json
{
  "streamSessionId": "session-uuid"
}
```

Then connect to SSE endpoint:

```http
GET /api/stream/:sessionId
```

**SSE Events:**

```
data: {"type":"content","content":"Here's"}

data: {"type":"content","content":" a"}

data: {"type":"content","content":" Python"}

data: {"type":"tool_call","toolCall":{"id":"call-1","name":"code_exec","parameters":{"language":"python","code":"..."}}}

data: {"type":"content","content":"The code executed successfully"}

data: {"type":"done","usage":{"inputTokens":50,"outputTokens":100,"totalTokens":150}}
```

---

### Continue Conversation

```http
POST /api/run/:runId/continue
Content-Type: application/json

{
  "message": "Can you make it sort in descending order?"
}
```

**Response (200 OK):**

```json
{
  "runId": "run-uuid",
  "status": "completed",
  "response": "Here's the updated function:\n\n```python\ndef sort_list(items):\n    return sorted(items, reverse=True)\n```"
}
```

---

## Model Discovery

### List Models

```http
GET /api/models?provider=ollama&refresh=true
```

**Query Parameters:**

- `provider` (optional): Filter by provider (`ollama`, `openrouter`, `openai`, `anthropic`)
- `refresh` (optional): Force refresh from providers (default: false)

**Response (200 OK):**

```json
{
  "models": [
    {
      "id": "ollama:llama3.2",
      "provider": "ollama",
      "displayName": "Llama 3.2",
      "size": "8B",
      "contextWindow": 8192,
      "supportsTools": true,
      "supportsStreaming": true,
      "lastUsed": "2025-11-22T09:30:00.000Z"
    },
    {
      "id": "openrouter:anthropic/claude-3.5-sonnet",
      "provider": "openrouter",
      "displayName": "Claude 3.5 Sonnet",
      "contextWindow": 200000,
      "supportsTools": true,
      "supportsStreaming": true,
      "cost": {
        "inputPer1M": 3.0,
        "outputPer1M": 15.0
      },
      "strengths": ["reasoning", "code", "analysis"]
    }
  ],
  "total": 2
}
```

---

### Get Model Info

```http
GET /api/models/:modelId
```

**Example:**

```http
GET /api/models/ollama:llama3.2
```

**Response (200 OK):**

```json
{
  "id": "ollama:llama3.2",
  "provider": "ollama",
  "displayName": "Llama 3.2",
  "size": "8B",
  "contextWindow": 8192,
  "supportsTools": true,
  "supportsStreaming": true,
  "speed": 45.2,
  "lastUsed": "2025-11-22T09:30:00.000Z",
  "metadata": {
    "family": "llama",
    "parameterSize": "8B",
    "quantization": "Q4_0"
  }
}
```

**Errors:**

- `404 Not Found` - Model doesn't exist

---

## Tool Management

### List Tools

```http
GET /api/tools
```

**Response (200 OK):**

```json
{
  "tools": [
    {
      "name": "shell",
      "description": "Execute shell commands in a sandboxed temporary directory",
      "available": true,
      "parameters": {
        "type": "object",
        "properties": {
          "command": {
            "type": "string",
            "description": "The shell command to execute",
            "required": true
          }
        },
        "required": ["command"]
      }
    },
    {
      "name": "file",
      "description": "Read, write, or list files within the workspace directory",
      "available": true,
      "parameters": {
        "type": "object",
        "properties": {
          "operation": {
            "type": "string",
            "description": "Operation to perform",
            "required": true,
            "enum": ["read", "write", "list", "delete"]
          },
          "path": {
            "type": "string",
            "description": "File path (relative to workspace)",
            "required": true
          }
        },
        "required": ["operation", "path"]
      }
    }
  ],
  "total": 2
}
```

---

### Test Tool (Debug)

```http
POST /api/tools/test
Content-Type: application/json

{
  "toolName": "http",
  "parameters": {
    "method": "GET",
    "url": "https://api.github.com/zen"
  }
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "output": "Request successful (200 OK)",
  "data": {
    "status": 200,
    "statusText": "OK",
    "body": "Design for failure."
  },
  "executionTimeMs": 234
}
```

**Errors:**

- `404 Not Found` - Tool doesn't exist
- `400 Bad Request` - Invalid parameters

---

## Execution History

### Get Run

```http
GET /api/runs/:runId
```

**Response (200 OK):**

```json
{
  "id": "run-uuid",
  "agentId": "agent-1",
  "modelUsed": "ollama:llama3.2",
  "status": "completed",
  "turns": [
    {
      "turnNumber": 1,
      "userMessage": "Write a Python function",
      "assistantMessage": "Here's a Python function...",
      "toolExecutions": [
        {
          "id": "exec-1",
          "toolName": "code_exec",
          "parameters": {
            "language": "python",
            "code": "def sort_list(items):\n    return sorted(items)"
          },
          "result": {
            "success": true,
            "output": "Code executed successfully"
          },
          "timestamp": "2025-11-22T10:05:00.000Z"
        }
      ],
      "usage": {
        "inputTokens": 50,
        "outputTokens": 100,
        "totalTokens": 150
      },
      "timestamp": "2025-11-22T10:05:00.000Z"
    }
  ],
  "totalTokens": {
    "inputTokens": 50,
    "outputTokens": 100,
    "totalTokens": 150
  },
  "totalToolCalls": 1,
  "createdAt": "2025-11-22T10:00:00.000Z",
  "completedAt": "2025-11-22T10:05:30.000Z"
}
```

**Errors:**

- `404 Not Found` - Run doesn't exist

---

### List Runs

```http
GET /api/runs?agentId=agent-1&status=completed&limit=20&offset=0
```

**Query Parameters:**

- `agentId` (optional): Filter by agent
- `status` (optional): Filter by status (`running`, `completed`, `error`)
- `fromDate` (optional): ISO date string
- `toDate` (optional): ISO date string
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response (200 OK):**

```json
{
  "runs": [
    {
      "id": "run-1",
      "agentId": "agent-1",
      "modelUsed": "ollama:llama3.2",
      "status": "completed",
      "totalTokens": {
        "inputTokens": 50,
        "outputTokens": 100,
        "totalTokens": 150
      },
      "totalToolCalls": 1,
      "createdAt": "2025-11-22T10:00:00.000Z",
      "completedAt": "2025-11-22T10:05:30.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

### Get Tool Statistics

```http
GET /api/agents/:agentId/stats/tools
```

**Response (200 OK):**

```json
{
  "stats": [
    {
      "toolName": "code_exec",
      "totalExecutions": 45,
      "successRate": 95.5,
      "avgExecutionTimeMs": 234
    },
    {
      "toolName": "http",
      "totalExecutions": 23,
      "successRate": 100.0,
      "avgExecutionTimeMs": 456
    }
  ]
}
```

---

## Health Check

### System Health

```http
GET /api/health
```

**Response (200 OK):**

```json
{
  "status": "healthy",
  "checks": {
    "database": true,
    "ollama": true,
    "tools": true
  },
  "timestamp": "2025-11-22T10:00:00.000Z"
}
```

**Status Values:**

- `healthy` - All systems operational
- `degraded` - Some systems unavailable
- `unhealthy` - Critical systems down

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "field": "fieldName",
    "details": {}
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED_TOOL` | 403 | Tool not allowed for agent |
| `MODEL_ERROR` | 502 | LLM provider error |
| `TOOL_EXECUTION_ERROR` | 500 | Tool execution failed |
| `INTERNAL_ERROR` | 500 | Unexpected error |

---

## Next.js Route Handler Example

```typescript
// app/api/agents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/infrastructure/config/bootstrap';

export async function GET(request: NextRequest) {
  try {
    const container = await getContainer();
    const useCase = container.useCases.listAgents();

    const searchParams = request.nextUrl.searchParams;
    const agents = await useCase.execute({
      tags: searchParams.get('tags')?.split(','),
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    });

    return NextResponse.json({
      agents,
      total: agents.length,
      limit: 50,
      offset: 0,
    });
  } catch (error) {
    console.error('Failed to list agents:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list agents',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const container = await getContainer();
    const useCase = container.useCases.createAgent();

    const body = await request.json();
    const agent = await useCase.execute(body);

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            field: error.field,
          },
        },
        { status: 400 }
      );
    }

    console.error('Failed to create agent:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create agent',
        },
      },
      { status: 500 }
    );
  }
}
```

---

## SSE Streaming Implementation

```typescript
// app/api/stream/[sessionId]/route.ts
import { NextRequest } from 'next/server';
import { getContainer } from '@/infrastructure/config/bootstrap';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const container = await getContainer();
  const streamingAdapter = container.streamingPort as SSEStreamingAdapter;

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Register session with controller
      const encoder = new TextEncoder();

      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const close = () => {
        controller.close();
      };

      streamingAdapter.registerSession(params.sessionId, { send, close });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-22
