'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center max-w-2xl px-4">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Local Agent Builder
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
          Build and run AI agents locally with tool-use capabilities. 
          Supports local models (Ollama) and remote models (OpenRouter, OpenAI, Anthropic).
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg hover:shadow-xl"
          >
            Get Started
          </button>
          <button
            onClick={() => router.push('/docs')}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            View Docs
          </button>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="font-semibold mb-2">🤖 Agent Management</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create, edit, and manage multiple agent configurations with custom system prompts and tool allowlists.
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="font-semibold mb-2">🔧 Tool System</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Built-in tools for shell commands, HTTP requests, file operations, and code execution with security sandboxing.
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="font-semibold mb-2">📊 Execution Tracing</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Detailed logs of agent runs, tool calls, token usage, and performance metrics.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
