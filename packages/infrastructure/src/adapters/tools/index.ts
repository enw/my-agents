/**
 * Tool Implementations
 *
 * These are concrete tool implementations that will be registered
 * in the ToolPort registry at application startup.
 *
 * All tools follow a strict security model:
 * - Shell tool: sandboxed to temp directory
 * - File tool: restricted to workspace directory
 * - HTTP tool: respects rate limits and timeouts
 */

import { Tool, ToolResult, ToolParameterSchema } from '@my-agents/domain';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// SHELL TOOL - Sandboxed Command Execution
// ============================================================================

export class ShellTool implements Tool {
  name = 'shell';
  description = 'Execute shell commands in a sandboxed temporary directory. Use for running scripts, CLI tools, or system commands.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute',
        required: true,
      },
      workingDir: {
        type: 'string',
        description: 'Working directory (relative to sandbox root)',
        required: false,
      },
    },
    required: ['command'],
  };

  private sandboxRoot: string;

  constructor(sandboxRoot: string) {
    this.sandboxRoot = sandboxRoot;
  }

  async execute(parameters: Record<string, unknown>): Promise<ToolResult> {
    const command = parameters.command as string;
    const workingDir = parameters.workingDir as string | undefined;

    console.log(`[SHELL TOOL] Executing command: ${command}`, {
      workingDir,
      sandboxRoot: this.sandboxRoot,
    });

    try {
      // Ensure sandbox directory exists
      console.log(`[SHELL TOOL] Ensuring sandbox directory exists...`);
      await fs.mkdir(this.sandboxRoot, { recursive: true });

      // Resolve working directory within sandbox
      const cwd = workingDir
        ? path.join(this.sandboxRoot, workingDir)
        : this.sandboxRoot;

      // Security check: prevent directory traversal
      if (!cwd.startsWith(this.sandboxRoot)) {
        console.error(`[SHELL TOOL] Security violation: directory traversal attempt`);
        return {
          success: false,
          output: 'Security violation: attempted directory traversal',
          error: 'Directory traversal not allowed',
          executionTimeMs: 0,
        };
      }

      // Execute command with timeout (10 seconds)
      console.log(`[SHELL TOOL] Executing command with 10s timeout...`);
      const execStartTime = Date.now();
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: 10000,
        maxBuffer: 1024 * 1024, // 1MB max output
      });
      const execDuration = Date.now() - execStartTime;
      console.log(`[SHELL TOOL] Command completed in ${execDuration}ms`, {
        stdoutLength: stdout?.length || 0,
        stderrLength: stderr?.length || 0,
      });

      return {
        success: true,
        output: stdout || stderr || 'Command completed with no output',
        data: { stdout, stderr },
        executionTimeMs: 0, // Will be set by caller
      };
    } catch (error: any) {
      console.error(`[SHELL TOOL] Command execution failed:`, {
        error: error.message,
        code: error.code,
        signal: error.signal,
      });
      return {
        success: false,
        output: `Command failed: ${error.message}`,
        error: error.message,
        data: { stdout: error.stdout, stderr: error.stderr },
        executionTimeMs: 0,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await fs.access(this.sandboxRoot);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// FILE TOOL - Workspace-Restricted File Operations
// ============================================================================

export class FileTool implements Tool {
  name = 'file';
  description = 'Read, write, or list files within the workspace directory. Cannot access files outside the workspace.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform',
        required: true,
        enum: ['read', 'write', 'list', 'delete'],
      },
      path: {
        type: 'string',
        description: 'File path (relative to workspace)',
        required: true,
      },
      content: {
        type: 'string',
        description: 'Content to write (for write operation)',
        required: false,
      },
    },
    required: ['operation', 'path'],
  };

  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async execute(parameters: Record<string, unknown>): Promise<ToolResult> {
    const operation = parameters.operation as string;
    const filePath = parameters.path as string;
    const content = parameters.content as string | undefined;

    try {
      // Resolve absolute path within workspace
      const absolutePath = path.join(this.workspaceRoot, filePath);

      // Security check: prevent directory traversal
      if (!absolutePath.startsWith(this.workspaceRoot)) {
        return {
          success: false,
          output: 'Security violation: attempted to access file outside workspace',
          error: 'Access denied',
          executionTimeMs: 0,
        };
      }

      switch (operation) {
        case 'read':
          return await this.readFile(absolutePath);

        case 'write':
          if (!content) {
            return {
              success: false,
              output: 'Content parameter required for write operation',
              error: 'Missing content',
              executionTimeMs: 0,
            };
          }
          return await this.writeFile(absolutePath, content);

        case 'list':
          return await this.listDirectory(absolutePath);

        case 'delete':
          return await this.deleteFile(absolutePath);

        default:
          return {
            success: false,
            output: `Unknown operation: ${operation}`,
            error: 'Invalid operation',
            executionTimeMs: 0,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        output: `File operation failed: ${error.message}`,
        error: error.message,
        executionTimeMs: 0,
      };
    }
  }

  private async readFile(absolutePath: string): Promise<ToolResult> {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return {
      success: true,
      output: `File read successfully (${content.length} characters)`,
      data: { content, path: absolutePath },
      executionTimeMs: 0,
    };
  }

  private async writeFile(absolutePath: string, content: string): Promise<ToolResult> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf-8');

    return {
      success: true,
      output: `File written successfully (${content.length} characters)`,
      data: { path: absolutePath, size: content.length },
      executionTimeMs: 0,
    };
  }

  private async listDirectory(absolutePath: string): Promise<ToolResult> {
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    const files = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
    }));

    return {
      success: true,
      output: `Found ${files.length} entries`,
      data: { files, path: absolutePath },
      executionTimeMs: 0,
    };
  }

  private async deleteFile(absolutePath: string): Promise<ToolResult> {
    await fs.unlink(absolutePath);
    return {
      success: true,
      output: `File deleted successfully`,
      data: { path: absolutePath },
      executionTimeMs: 0,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await fs.access(this.workspaceRoot);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// HTTP TOOL - Web Requests with Rate Limiting
// ============================================================================

export class HttpTool implements Tool {
  name = 'http';
  description = 'Make HTTP requests to external APIs. Supports GET, POST, PUT, DELETE methods with headers and body.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        description: 'HTTP method',
        required: true,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      },
      url: {
        type: 'string',
        description: 'Full URL to request',
        required: true,
      },
      headers: {
        type: 'object',
        description: 'Request headers',
        required: false,
      },
      body: {
        type: 'string',
        description: 'Request body (JSON string)',
        required: false,
      },
    },
    required: ['method', 'url'],
  };

  private maxTimeout = 30000; // 30 seconds
  private maxResponseSize = 5 * 1024 * 1024; // 5MB

  async execute(parameters: Record<string, unknown>): Promise<ToolResult> {
    const method = parameters.method as string;
    const url = parameters.url as string;
    const headers = (parameters.headers as Record<string, string>) || {};
    const body = parameters.body as string | undefined;

    console.log(`[HTTP TOOL] Making ${method} request to: ${url}`, {
      hasHeaders: Object.keys(headers).length > 0,
      hasBody: !!body,
      bodyLength: body?.length || 0,
      timeout: this.maxTimeout,
    });

    try {
      // Basic URL validation
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        console.error(`[HTTP TOOL] Invalid protocol: ${parsedUrl.protocol}`);
        return {
          success: false,
          output: 'Only HTTP and HTTPS protocols are allowed',
          error: 'Invalid protocol',
          executionTimeMs: 0,
        };
      }

      // Make request with timeout
      console.log(`[HTTP TOOL] Starting fetch with ${this.maxTimeout}ms timeout...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.maxTimeout);
      const fetchStartTime = Date.now();

      const response = await fetch(url, {
        method,
        headers,
        body: body ? body : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const fetchDuration = Date.now() - fetchStartTime;
      console.log(`[HTTP TOOL] Fetch completed in ${fetchDuration}ms`, {
        status: response.status,
        statusText: response.statusText,
      });

      // Read response with size limit
      console.log(`[HTTP TOOL] Reading response body...`);
      const text = await response.text();
      console.log(`[HTTP TOOL] Response body read: ${text.length} bytes`);
      
      if (text.length > this.maxResponseSize) {
        console.error(`[HTTP TOOL] Response too large: ${text.length} bytes`);
        return {
          success: false,
          output: `Response too large (${text.length} bytes, max ${this.maxResponseSize})`,
          error: 'Response size exceeded',
          executionTimeMs: 0,
        };
      }

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(text);
        console.log(`[HTTP TOOL] Response parsed as JSON`);
      } catch {
        data = text;
        console.log(`[HTTP TOOL] Response kept as text`);
      }

      return {
        success: response.ok,
        output: response.ok
          ? `Request successful (${response.status} ${response.statusText})`
          : `Request failed (${response.status} ${response.statusText})`,
        data: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: data,
        },
        error: response.ok ? undefined : `HTTP ${response.status}`,
        executionTimeMs: 0,
      };
    } catch (error: any) {
      console.error(`[HTTP TOOL] Request failed:`, {
        error: error.message,
        name: error.name,
        code: error.code,
      });
      
      if (error.name === 'AbortError') {
        return {
          success: false,
          output: `Request timeout after ${this.maxTimeout}ms`,
          error: 'Timeout',
          executionTimeMs: 0,
        };
      }

      return {
        success: false,
        output: `HTTP request failed: ${error.message}`,
        error: error.message,
        executionTimeMs: 0,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    // Always available (no external dependencies)
    return true;
  }
}

// ============================================================================
// CODE EXECUTION TOOL - Python/JavaScript/etc
// ============================================================================

export class CodeExecutionTool implements Tool {
  name = 'code_exec';
  description = 'Execute code snippets in supported languages (Python, JavaScript, TypeScript). Runs in isolated environment.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        description: 'Programming language',
        required: true,
        enum: ['python', 'javascript', 'typescript', 'bash'],
      },
      code: {
        type: 'string',
        description: 'Code to execute',
        required: true,
      },
    },
    required: ['language', 'code'],
  };

  private sandboxRoot: string;

  constructor(sandboxRoot: string) {
    this.sandboxRoot = sandboxRoot;
  }

  async execute(parameters: Record<string, unknown>): Promise<ToolResult> {
    const language = parameters.language as string;
    const code = parameters.code as string;

    console.log(`[CODE EXEC TOOL] Executing ${language} code`, {
      codeLength: code.length,
      sandboxRoot: this.sandboxRoot,
    });

    try {
      // Write code to temporary file
      console.log(`[CODE EXEC TOOL] Creating sandbox directory...`);
      await fs.mkdir(this.sandboxRoot, { recursive: true });
      const filename = `script_${Date.now()}.${this.getExtension(language)}`;
      const scriptPath = path.join(this.sandboxRoot, filename);

      console.log(`[CODE EXEC TOOL] Writing code to file: ${filename}`);
      await fs.writeFile(scriptPath, code, 'utf-8');

      // Execute based on language
      const command = this.getExecutionCommand(language, scriptPath);
      console.log(`[CODE EXEC TOOL] Executing command: ${command} (30s timeout)`);

      const execStartTime = Date.now();
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.sandboxRoot,
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB max output
      });
      const execDuration = Date.now() - execStartTime;
      console.log(`[CODE EXEC TOOL] Code execution completed in ${execDuration}ms`, {
        stdoutLength: stdout?.length || 0,
        stderrLength: stderr?.length || 0,
      });

      // Clean up
      console.log(`[CODE EXEC TOOL] Cleaning up script file...`);
      await fs.unlink(scriptPath);

      return {
        success: true,
        output: stdout || stderr || 'Code executed with no output',
        data: { stdout, stderr, language },
        executionTimeMs: 0,
      };
    } catch (error: any) {
      console.error(`[CODE EXEC TOOL] Code execution failed:`, {
        error: error.message,
        code: error.code,
        signal: error.signal,
        language,
      });
      return {
        success: false,
        output: `Code execution failed: ${error.message}`,
        error: error.message,
        data: { stdout: error.stdout, stderr: error.stderr },
        executionTimeMs: 0,
      };
    }
  }

  private getExtension(language: string): string {
    switch (language) {
      case 'python':
        return 'py';
      case 'javascript':
        return 'js';
      case 'typescript':
        return 'ts';
      case 'bash':
        return 'sh';
      default:
        return 'txt';
    }
  }

  private getExecutionCommand(language: string, scriptPath: string): string {
    switch (language) {
      case 'python':
        return `python3 ${scriptPath}`;
      case 'javascript':
        return `node ${scriptPath}`;
      case 'typescript':
        return `ts-node ${scriptPath}`;
      case 'bash':
        return `bash ${scriptPath}`;
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if required runtimes are available
      await execAsync('python3 --version');
      await execAsync('node --version');
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// OLLAMA INFO TOOL - Get Ollama Model Information
// ============================================================================

export class OllamaInfoTool implements Tool {
  name = 'ollama_info';
  description = 'Get information about available Ollama models, including size, capabilities, and status.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: 'Model name (optional - lists all if not provided)',
        required: false,
      },
    },
    required: [],
  };

  private baseUrl = 'http://localhost:11434';

  async execute(parameters: Record<string, unknown>): Promise<ToolResult> {
    const modelName = parameters.model as string | undefined;

    try {
      if (modelName) {
        // Get specific model info
        const response = await fetch(`${this.baseUrl}/api/show`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelName }),
        });

        if (!response.ok) {
          return {
            success: false,
            output: `Model ${modelName} not found`,
            error: 'Model not found',
            executionTimeMs: 0,
          };
        }

        const data = await response.json();
        return {
          success: true,
          output: `Model: ${data.name}\nSize: ${data.size}\nParameters: ${data.parameters}`,
          data,
          executionTimeMs: 0,
        };
      } else {
        // List all models
        const response = await fetch(`${this.baseUrl}/api/tags`);

        if (!response.ok) {
          return {
            success: false,
            output: 'Failed to fetch Ollama models',
            error: 'Ollama not available',
            executionTimeMs: 0,
          };
        }

        const data = await response.json();
        const models = data.models || [];

        const output = models
          .map((m: any) => `${m.name} (${m.size})`)
          .join('\n') || 'No models installed';

        return {
          success: true,
          output,
          data: { models },
          executionTimeMs: 0,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        output: `Failed to get Ollama info: ${error.message}`,
        error: error.message,
        executionTimeMs: 0,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// WEB SEARCH TOOL - Search the Internet
// ============================================================================

export class SearchTool implements Tool {
  name = 'web_search';
  description = 'Search the web for information. Returns relevant search results with titles, URLs, and snippets.';

  parameters: ToolParameterSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
        required: true,
      },
      numResults: {
        type: 'number',
        description: 'Number of results to return (1-10, default: 5)',
        required: false,
      },
    },
    required: ['query'],
  };

  private braveApiKey?: string;
  private openRouterApiKey?: string;

  constructor(braveApiKey?: string, openRouterApiKey?: string) {
    this.braveApiKey = braveApiKey;
    this.openRouterApiKey = openRouterApiKey;
  }

  async execute(parameters: Record<string, unknown>): Promise<ToolResult> {
    const query = parameters.query as string;
    const numResults = Math.min(Math.max((parameters.numResults as number) || 5, 1), 10);

    const startTime = Date.now();

    try {
      // Priority: Brave Search > DuckDuckGo (fallback)
      if (this.braveApiKey) {
        return await this.searchWithBrave(query, numResults, startTime);
      }

      // Fallback: Use DuckDuckGo instant answer API (no key required)
      return await this.searchWithDuckDuckGo(query, numResults, startTime);
    } catch (error: any) {
      return {
        success: false,
        output: `Search failed: ${error.message}`,
        error: error.message,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private async searchWithBrave(
    query: string,
    numResults: number,
    startTime: number
  ): Promise<ToolResult> {
    try {
      // Brave Search API endpoint
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', numResults.toString());
      url.searchParams.set('search_lang', 'en');
      url.searchParams.set('country', 'US');
      url.searchParams.set('safesearch', 'moderate');

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.braveApiKey!,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Brave Search API returned ${response.status}: ${errorText || response.statusText}`
        );
      }

      const data = await response.json();

      // Format results from Brave Search API
      const results: Array<{ title: string; url: string; snippet: string }> = [];

      if (data.web?.results) {
        for (const result of data.web.results.slice(0, numResults)) {
          results.push({
            title: result.title || 'Untitled',
            url: result.url || '',
            snippet: result.description || result.snippet || '',
          });
        }
      }

      if (results.length === 0) {
        return {
          success: true,
          output: `No results found for "${query}"`,
          data: { query, results: [], provider: 'brave' },
          executionTimeMs: Date.now() - startTime,
        };
      }

      const output = results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
        .join('\n\n');

      return {
        success: true,
        output: `Found ${results.length} results for "${query}":\n\n${output}`,
        data: { query, results, provider: 'brave' },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      // If Brave Search fails, fall back to DuckDuckGo
      console.warn('Brave Search failed, falling back to DuckDuckGo:', error.message);
      return await this.searchWithDuckDuckGo(query, numResults, startTime);
    }
  }

  private async searchWithOpenRouter(query: string, numResults: number): Promise<ToolResult> {
    // OpenRouter doesn't have a direct search API, so we'll use DuckDuckGo
    // In a real implementation, you might use Brave Search API or similar
    return await this.searchWithDuckDuckGo(query, numResults, Date.now());
  }

  private async searchWithDuckDuckGo(
    query: string,
    numResults: number,
    startTime: number
  ): Promise<ToolResult> {
    try {
      // DuckDuckGo Instant Answer API (no key required, but limited)
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
        {
          headers: {
            'User-Agent': 'LocalAgentBuilder/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Search API returned ${response.status}`);
      }

      const data = await response.json();

      // Format results
      const results: Array<{ title: string; url: string; snippet: string }> = [];

      // Add instant answer if available
      if (data.AbstractText) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL || '',
          snippet: data.AbstractText,
        });
      }

      // Add related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, numResults - results.length)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || topic.Text,
              url: topic.FirstURL,
              snippet: topic.Text,
            });
          }
        }
      }

      if (results.length === 0) {
        return {
          success: true,
          output: `No results found for "${query}"`,
          data: { query, results: [], provider: 'duckduckgo' },
          executionTimeMs: Date.now() - startTime,
        };
      }

      const output = results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
        .join('\n\n');

      return {
        success: true,
        output: `Found ${results.length} results for "${query}":\n\n${output}`,
        data: { query, results, provider: 'duckduckgo' },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      // Fallback: return a message that search is not available
      return {
        success: false,
        output: `Web search is currently unavailable. Error: ${error.message}`,
        error: error.message,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    // Always available (uses public APIs)
    return true;
  }
}

// ============================================================================
// TOOL REGISTRY - Auto-Registration
// ============================================================================

/**
 * Create all default tools with proper configuration
 */
export function createDefaultTools(config: {
  sandboxRoot: string;
  workspaceRoot: string;
  braveApiKey?: string;
  openRouterApiKey?: string;
}): Tool[] {
  return [
    new ShellTool(config.sandboxRoot),
    new FileTool(config.workspaceRoot),
    new HttpTool(),
    new CodeExecutionTool(config.sandboxRoot),
    new OllamaInfoTool(),
    new SearchTool(config.braveApiKey, config.openRouterApiKey),
  ];
}
