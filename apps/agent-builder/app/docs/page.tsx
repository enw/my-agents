'use client';

import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            ← Back to Home
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
          <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">
            Local Agent Builder Documentation
          </h1>

          <div className="prose dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">What is Local Agent Builder?</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Local Agent Builder is a minimalist Next.js application for building, testing, and
                interacting with tool-using AI agents locally. It supports both local models
                (Ollama) and remote models (OpenRouter, OpenAI, Anthropic) with a unified interface.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Key Features</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>
                  <strong>Local-First Architecture:</strong> Run entirely on your machine with
                  local models via Ollama
                </li>
                <li>
                  <strong>Multi-Provider Support:</strong> Seamlessly switch between Ollama,
                  OpenRouter, OpenAI, and Anthropic
                </li>
                <li>
                  <strong>Tool System:</strong> Built-in tools for shell commands, HTTP requests,
                  file operations, and code execution
                </li>
                <li>
                  <strong>Agent Management:</strong> Create, edit, and manage multiple agent
                  configurations
                </li>
                <li>
                  <strong>Execution Tracing:</strong> Detailed logs of agent runs, tool calls, and
                  token usage
                </li>
                <li>
                  <strong>Security:</strong> Sandboxed tool execution with per-agent allowlisting
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
              <ol className="list-decimal pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>
                  Install dependencies: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">npm install</code>
                </li>
                <li>
                  Set up environment variables in <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">.env.local</code>
                </li>
                <li>
                  (Optional) Install Ollama and pull models: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">ollama pull llama3.2</code>
                </li>
                <li>
                  Start the development server: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">npm run dev</code>
                </li>
                <li>
                  Navigate to the dashboard and create your first agent!
                </li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">API Endpoints</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Agents</h3>
                  <ul className="list-disc pl-6 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    <li><code>GET /api/agents</code> - List all agents</li>
                    <li><code>POST /api/agents</code> - Create a new agent</li>
                    <li><code>GET /api/agents/:id</code> - Get agent details</li>
                    <li><code>PUT /api/agents/:id</code> - Update an agent</li>
                    <li><code>DELETE /api/agents/:id</code> - Delete an agent</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Execution</h3>
                  <ul className="list-disc pl-6 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    <li><code>POST /api/run</code> - Execute an agent</li>
                    <li><code>GET /api/runs</code> - List execution history</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Models & Tools</h3>
                  <ul className="list-disc pl-6 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    <li><code>GET /api/models</code> - List available models</li>
                    <li><code>GET /api/tools</code> - List available tools</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Built-In Tools</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Shell Tool</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Execute shell commands in a sandboxed temporary directory with 30-second timeout
                    and 1MB output buffer limit.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">HTTP Tool</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Fetch data from HTTP endpoints with 10-second timeout and size limits.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">File Tool</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Read, write, and list files in the workspace directory with path traversal
                    prevention.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Code Executor Tool</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Execute Python or JavaScript code in a sandboxed environment with 30-second
                    timeout.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Security Model</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Agents must explicitly declare which tools they can use. Tool access is enforced at
                runtime. If an agent tries to call an unauthorized tool, the execution fails.
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                All tools run in sandboxed environments with appropriate timeouts and resource
                limits.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

