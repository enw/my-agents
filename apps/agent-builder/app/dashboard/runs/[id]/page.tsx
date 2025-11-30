'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import TraceViewer from '../../../components/TraceViewer';

export default function RunDetailPage() {
  const router = useRouter();
  const params = useParams();
  const runId = params.id as string;

  const [run, setRun] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadRun();
  }, [runId]);

  async function loadRun() {
    setLoading(true);
    try {
      const response = await fetch(`/api/runs/${runId}`);
      if (!response.ok) {
        throw new Error('Failed to load run');
      }
      const data = await response.json();
      setRun(data);

      // Load agent details
      if (data.agentId) {
        const agentResponse = await fetch(`/api/agents/${data.agentId}`);
        if (agentResponse.ok) {
          const agentData = await agentResponse.json();
          setAgent(agentData);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this run? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/runs/${runId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete run');
      }

      // Redirect to runs list after successful deletion
      router.push('/dashboard/runs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete run');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading run...</p>
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Run not found'}</p>
          <Link
            href="/dashboard/runs"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            ← Back to Runs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/dashboard/runs"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-4 inline-block"
            >
              ← Back to Runs
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Run Details
            </h1>
            {agent && (
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Agent: {agent.name}
              </p>
            )}
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {deleting ? 'Deleting...' : 'Delete Run'}
          </button>
        </div>
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Trace Viewer */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Execution Trace
              </h2>
              <div className="h-[calc(100vh-300px)] overflow-auto">
                <TraceViewer run={run} loading={false} />
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Run Information</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className={`ml-2 font-medium ${
                    run.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                    run.status === 'error' ? 'text-red-600 dark:text-red-400' :
                    'text-yellow-600 dark:text-yellow-400'
                  }`}>
                    {run.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Model:</span>
                  <span className="ml-2 text-gray-900 dark:text-white font-mono text-xs">
                    {run.modelUsed}
                  </span>
                </div>
                {run.agentVersion && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Version:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-mono text-xs">
                      {run.agentVersion}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Created:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">
                    {new Date(run.createdAt).toLocaleString()}
                  </span>
                </div>
                {run.completedAt && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Completed:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {new Date(run.completedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {run.error && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Error:</span>
                    <p className="mt-1 p-2 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded text-xs">
                      {run.error}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Token Usage</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {run.totalTokens.totalTokens.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Input:</span>
                  <span className="text-gray-900 dark:text-white">
                    {run.totalTokens.inputTokens.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Output:</span>
                  <span className="text-gray-900 dark:text-white">
                    {run.totalTokens.outputTokens.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Statistics</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Tool Calls:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {run.totalToolCalls}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Turns:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {run.turns?.length || 0}
                  </span>
                </div>
              </div>
            </div>

            {agent && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Agent</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Name:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{agent.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Description:</span>
                    <p className="mt-1 text-gray-900 dark:text-white">{agent.description}</p>
                  </div>
                  <Link
                    href={`/dashboard/chat/${agent.id}`}
                    className="block mt-4 text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm"
                  >
                    Chat with this agent →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}

