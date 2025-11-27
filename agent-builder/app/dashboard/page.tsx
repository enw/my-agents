'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  description: string;
  defaultModel: string;
  allowedTools: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      setLoading(true);
      const response = await fetch('/api/agents');
      if (!response.ok) {
        throw new Error('Failed to load agents');
      }
      const data = await response.json();
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this agent?')) {
      return;
    }

    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete agent');
      }
      await loadAgents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete agent');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Agent Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage your AI agents and view execution history
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Home
            </Link>
            <button
              onClick={() => router.push('/dashboard/new')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              + New Agent
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading agents...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No agents yet. Create your first agent to get started!
            </p>
            <button
              onClick={() => router.push('/dashboard/new')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Create Your First Agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {agent.name}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/dashboard/chat/${agent.id}`)}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm"
                      title="Chat with agent"
                    >
                      💬
                    </button>
                    <button
                      onClick={() => router.push(`/dashboard/edit/${agent.id}`)}
                      className="text-gray-600 hover:text-gray-700 dark:text-gray-400 text-sm"
                      title="Edit agent"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(agent.id)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 text-sm"
                      title="Delete agent"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {agent.description}
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {agent.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                  <div>Model: {agent.defaultModel}</div>
                  <div>Tools: {agent.allowedTools.length}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

