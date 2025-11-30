# SME Agent Implementation Status & TODO

**Last Updated:** 2025-01-XX  
**Status:** Partially Implemented - Core functionality available with limitations

## ✅ What You Can Do Right Now

### Available Tools
The following tools are currently available and can be used to create a functional SME agent:

1. **`web_search`** ✅
   - **Brave Search API** support (premium, requires `BRAVE_API_KEY`)
   - **DuckDuckGo** fallback (free, no API key required)
   - Automatic provider fallback on errors
   - Returns titles, URLs, snippets, and provider info
   - **Location:** `packages/infrastructure/src/adapters/tools/index.ts:673-805`
   - **Documentation:** See [Web Search Documentation](./WEB_SEARCH.md)

2. **`wikipedia`** ✅
   - Search Wikipedia articles by keyword
   - Get full articles or summaries
   - Intelligent caching (7-day TTL)
   - Fast cache retrieval
   - **Location:** `packages/infrastructure/src/adapters/tools/index.ts:885-1120`
   - **Documentation:** See [Wikipedia Tool Documentation](./WIKIPEDIA_TOOL.md)

3. **`http`** ✅
   - HTTP/API requests with 10-second timeout
   - GET, POST, PUT, DELETE methods
   - Headers and body support
   - **Location:** `packages/infrastructure/src/adapters/tools/index.ts:285-433`

4. **`file`** ✅
   - Read/write/list files in workspace directory
   - Path traversal prevention
   - **Limitation:** Text files only (no PDF/document parsing)
   - **Location:** `packages/infrastructure/src/adapters/tools/index.ts:128-283`

5. **`shell`** ✅
   - Execute shell commands in sandboxed temp directory
   - 10-second timeout, 1MB output limit
   - **Location:** `packages/infrastructure/src/adapters/tools/index.ts:25-126`

6. **`code_executor`** ✅
   - Execute Python/JavaScript code in sandbox
   - 30-second timeout
   - **Location:** `packages/infrastructure/src/adapters/tools/index.ts:440-569`

### Available Features
- ✅ System prompt configuration (full markdown support)
- ✅ Model selection (Ollama + OpenRouter)
- ✅ Tool allowlist per agent
- ✅ Temperature/maxTokens/topP settings
- ✅ Structured memory (auto-updated after conversations)
- ✅ Initial memory (pre-populate agent knowledge)
- ✅ Prompt versioning with commit messages
- ✅ Agent forking with memory copy option

### Current Capabilities
You can create an SME agent that:
- ✅ Conducts web research using `web_search`
- ✅ Retrieves Wikipedia articles with `wikipedia` (cached for speed)
- ✅ Accesses APIs and documentation via `http`
- ✅ Reads text files from workspace via `file`
- ✅ Maintains structured memory across conversations
- ✅ Uses appropriate model settings (temp: 0.3, maxTokens: 4096, topP: 0.9)

## ❌ What's Missing

### Critical Gaps

#### 1. PDF/Document Parsing Tool ❌
**Status:** Not Implemented  
**Priority:** HIGH  
**Impact:** Cannot read PDFs, Word docs, or other structured documents

**Required:**
- PDF parsing (e.g., `pdf-parse` library)
- Word document parsing (e.g., `mammoth` for .docx)
- Markdown/HTML parsing
- Text extraction and formatting

**Implementation Notes:**
- Create new `DocumentTool` class in `packages/infrastructure/src/adapters/tools/index.ts`
- Add to `createDefaultTools()` function
- Consider file type detection (extension or MIME type)
- Handle large documents (chunking strategy)

**Example Tool Interface:**
```typescript
class DocumentTool implements Tool {
  name = 'document';
  description = 'Parse and extract text from PDFs, Word documents, and other structured formats';
  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to document file' },
      format: { type: 'string', enum: ['pdf', 'docx', 'md', 'html'], required: false }
    },
    required: ['path']
  };
}
```

#### 2. Browser Rendering Tool ❌
**Status:** Not Implemented  
**Priority:** MEDIUM  
**Impact:** Cannot access dynamic web content, JavaScript-rendered pages

**Required:**
- Headless browser (Puppeteer or Playwright)
- Page rendering and interaction
- Screenshot capability (optional)
- JavaScript execution

**Implementation Notes:**
- High resource usage - consider rate limiting
- May require additional dependencies
- Consider Cloudflare Browser Rendering API if deploying to Workers
- Add timeout and memory limits

**Example Tool Interface:**
```typescript
class BrowserTool implements Tool {
  name = 'browser';
  description = 'Render and interact with dynamic web pages using headless browser';
  parameters = {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to render' },
      action: { type: 'string', enum: ['render', 'screenshot', 'extract'], required: false },
      waitFor: { type: 'string', description: 'CSS selector or time to wait', required: false }
    },
    required: ['url']
  };
}
```

#### 3. Database Query Tool ❌
**Status:** Not Implemented  
**Priority:** MEDIUM  
**Impact:** Cannot query structured data sources

**Required:**
- SQL query execution (SQLite, PostgreSQL)
- Query result formatting
- Connection management
- Security (read-only mode option, query validation)

**Implementation Notes:**
- Support multiple database types
- Add query timeout
- Validate SQL to prevent destructive operations
- Consider read-only mode by default

**Example Tool Interface:**
```typescript
class DatabaseTool implements Tool {
  name = 'database';
  description = 'Query structured databases (SQLite, PostgreSQL)';
  parameters = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'SQL query to execute' },
      database: { type: 'string', description: 'Database identifier', required: false }
    },
    required: ['query']
  };
}
```

#### 4. Enhanced Web Search ✅
**Status:** Implemented  
**Priority:** COMPLETE  
**Impact:** High-quality search with automatic fallback

**Current State:**
- ✅ Brave Search API integration (premium search)
- ✅ DuckDuckGo fallback (free, privacy-focused)
- ✅ Automatic provider fallback on errors
- ✅ Rich result formatting (titles, URLs, snippets)
- ✅ Provider information in results
- ✅ Execution time tracking

**Future Enhancements:**
- [ ] Search result caching
- [ ] Source credibility scoring
- [ ] Result deduplication
- [ ] Query refinement suggestions

**Documentation:** See [Web Search Documentation](./WEB_SEARCH.md)

#### 5. Citation Tracking System ❌
**Status:** Not Implemented  
**Priority:** LOW  
**Impact:** Manual citation management, no automatic source tracking

**Required:**
- Automatic source extraction from tool results
- Source database/storage
- Citation format generation
- Source reliability scoring

**Implementation Notes:**
- Could integrate with structured memory
- Store sources in agent's memory file
- Generate citations in multiple formats (APA, MLA, etc.)

## 🚧 Implementation Roadmap

### Phase 1: Core Research Tools (HIGH PRIORITY)
**Goal:** Enable basic document research capabilities

1. **Document Parsing Tool**
   - [ ] Install PDF parsing library (`pdf-parse`)
   - [ ] Install Word document library (`mammoth`)
   - [ ] Create `DocumentTool` class
   - [ ] Add file type detection
   - [ ] Implement text extraction
   - [ ] Add to tool registry
   - [ ] Test with sample PDFs and Word docs
   - [ ] Update UI to show new tool

2. **Enhanced Web Search** ✅
   - [x] Research Brave Search API (or alternative)
   - [x] Add API key configuration
   - [x] Improve result formatting
   - [x] Add source metadata extraction
   - [x] Test search quality improvements
   - [x] Implement automatic fallback to DuckDuckGo
   - [x] Add comprehensive documentation

**Estimated Time:** 2-3 days

### Phase 2: Advanced Research Tools (MEDIUM PRIORITY)
**Goal:** Enable dynamic content and database access

3. **Browser Rendering Tool**
   - [ ] Evaluate Puppeteer vs Playwright
   - [ ] Install chosen library
   - [ ] Create `BrowserTool` class
   - [ ] Implement page rendering
   - [ ] Add timeout and resource limits
   - [ ] Test with dynamic websites
   - [ ] Add to tool registry

4. **Database Query Tool**
   - [ ] Design database connection strategy
   - [ ] Create `DatabaseTool` class
   - [ ] Implement SQL query execution
   - [ ] Add query validation
   - [ ] Test with sample databases
   - [ ] Add to tool registry

**Estimated Time:** 3-5 days

### Phase 3: Quality Improvements (LOW PRIORITY)
**Goal:** Improve research quality and source management

5. **Citation Tracking**
   - [ ] Design source storage schema
   - [ ] Implement source extraction from tool results
   - [ ] Create citation formatter
   - [ ] Integrate with structured memory
   - [ ] Add citation UI in chat interface

**Estimated Time:** 2-3 days

## 📋 Quick Start: Creating an SME Agent Now

Even with current limitations, you can create a functional SME agent:

### Step 1: Create Agent
1. Go to `/dashboard/new`
2. Fill in:
   - **Name:** "SME Agent - [Domain]"
   - **Description:** "Expert researcher in [domain]"
   - **System Prompt:** Use template from `SME_AGENT_DESIGN.md` section 4
   - **Default Model:** Choose model with tool-use capability
   - **Allowed Tools:** Select `web_search`, `wikipedia`, `http`, `file`
   - **Settings:**
     - Temperature: `0.3`
     - Max Tokens: `4096`
     - Top P: `0.9`
   - **Initial Memory:** Pre-populate with domain knowledge

### Step 2: Test Research Capabilities
Test the agent with:
- "Research [topic] and provide sources"
- "Find information about [concept] from multiple sources"
- "Compare [A] vs [B] based on web research"

### Step 3: Limitations to Note
- Cannot read PDFs (text files only)
- Cannot access dynamic web content
- Web search: Brave Search (if API key set) or DuckDuckGo (fallback)
- No automatic citation tracking

## 🔍 File Locations

### Tool Implementations
- **Location:** `packages/infrastructure/src/adapters/tools/index.ts`
- **Registration:** `createDefaultTools()` function (line 814)
- **Tool Interface:** `packages/domain/src/ports/index.ts:270-285`

### Agent Creation UI
- **New Agent:** `apps/agent-builder/app/dashboard/new/page.tsx`
- **Edit Agent:** `apps/agent-builder/app/dashboard/edit/[id]/page.tsx`
- **API:** `apps/agent-builder/app/api/agents/route.ts`

### Agent Execution
- **Service:** `packages/domain/src/services/index.ts:79-621`
- **Tool Execution:** Lines 386-436

## 📝 Notes

- All tools must implement the `Tool` interface from `@my-agents/domain`
- Tools are registered at application startup in `bootstrap.ts`
- Tool security is enforced at runtime (agent allowlist)
- Structured memory is automatically updated after conversations
- Tool results are logged to run history for debugging

## 🎯 Success Criteria

An SME agent will be "complete" when it can:
- [x] Conduct web research
- [x] Access APIs and documentation
- [ ] Read PDFs and structured documents
- [ ] Access dynamic web content
- [ ] Query databases
- [x] Maintain structured memory
- [ ] Automatically track and cite sources
- [x] Synthesize information from multiple sources
- [x] Acknowledge uncertainties and limitations

**Current Completion:** ~65% (Core research works with enhanced web search, document/database access missing)

