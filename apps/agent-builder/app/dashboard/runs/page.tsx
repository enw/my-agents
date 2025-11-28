'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import MorphButton from '../../components/MorphButton';

interface Run {
  id: string;
  agentId: string;
  modelUsed: string;
  status: 'running' | 'completed' | 'error';
  totalTokens: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  totalToolCalls: number;
  createdAt: Date | string;
  completedAt?: Date | string;
  error?: string;
}

interface Agent {
  id: string;
  name: string;
}

type SortField = 'agent' | 'model' | 'status' | 'tokens' | 'toolCalls' | 'duration' | 'created';
type SortDirection = 'asc' | 'desc';

export default function RunsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [agents, setAgents] = useState<Map<string, Agent>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAgentId, setFilterAgentId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set());
  const [deletingRun, setDeletingRun] = useState<string | null>(null);

  useEffect(() => {
    loadRuns();
    loadAgents();
  }, [filterAgentId, filterStatus]);

  async function loadAgents() {
    try {
      const response = await fetch('/api/agents');
      if (response.ok) {
        const data = await response.json();
        const agentMap = new Map<string, Agent>();
        data.forEach((agent: Agent) => {
          agentMap.set(agent.id, agent);
        });
        setAgents(agentMap);
      }
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  }

  async function loadRuns() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAgentId) params.append('agentId', filterAgentId);
      if (filterStatus) params.append('status', filterStatus);
      
      const response = await fetch(`/api/runs?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load runs');
      }
      const data = await response.json();
      setRuns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteRun(runId: string) {
    if (!confirm('Are you sure you want to delete this run? This action cannot be undone.')) {
      return;
    }

    setDeletingRun(runId);
    try {
      const response = await fetch(`/api/runs/${runId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete run');
      }

      // Remove from selected if it was selected
      const newSelected = new Set(selectedRuns);
      newSelected.delete(runId);
      setSelectedRuns(newSelected);

      // Reload runs
      await loadRuns();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete run');
    } finally {
      setDeletingRun(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedRuns.size === 0) return;

    const count = selectedRuns.size;
    if (!confirm(`Are you sure you want to delete ${count} run(s)? This action cannot be undone.`)) {
      return;
    }

    setDeletingRun('bulk');
    try {
      // Delete all selected runs
      const deletePromises = Array.from(selectedRuns).map(runId =>
        fetch(`/api/runs/${runId}`, { method: 'DELETE' }).then(res => {
          if (!res.ok) throw new Error(`Failed to delete run ${runId}`);
          return res.json();
        })
      );

      await Promise.all(deletePromises);

      // Clear selection and reload
      setSelectedRuns(new Set());
      await loadRuns();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete runs');
    } finally {
      setDeletingRun(null);
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function formatDate(date: Date | string) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
  }

  function formatDuration(createdAt: Date | string, completedAt?: Date | string) {
    if (!completedAt) return 'Running...';
    const start = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const end = typeof completedAt === 'string' ? new Date(completedAt) : completedAt;
    const ms = end.getTime() - start.getTime();
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  }

  function getDuration(createdAt: Date | string, completedAt?: Date | string): number {
    if (!completedAt) return Infinity; // Running runs sort last
    const start = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const end = typeof completedAt === 'string' ? new Date(completedAt) : completedAt;
    return end.getTime() - start.getTime();
  }

  const sortedRuns = useMemo(() => {
    const sorted = [...runs];
    
    sorted.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'agent':
          aVal = agents.get(a.agentId)?.name || a.agentId;
          bVal = agents.get(b.agentId)?.name || b.agentId;
          break;
        case 'model':
          aVal = a.modelUsed;
          bVal = b.modelUsed;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'tokens':
          aVal = a.totalTokens.totalTokens;
          bVal = b.totalTokens.totalTokens;
          break;
        case 'toolCalls':
          aVal = a.totalToolCalls;
          bVal = b.totalToolCalls;
          break;
        case 'duration':
          aVal = getDuration(a.createdAt, a.completedAt);
          bVal = getDuration(b.createdAt, b.completedAt);
          break;
        case 'created':
          aVal = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt.getTime();
          bVal = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt.getTime();
          break;
      }

      // Handle string comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Handle number comparison (including Infinity for running runs)
      if (aVal === Infinity && bVal === Infinity) return 0;
      if (aVal === Infinity) return 1; // Running runs go to end
      if (bVal === Infinity) return -1;
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [runs, sortField, sortDirection, agents]);

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedRuns(new Set(sortedRuns.map(r => r.id)));
    } else {
      setSelectedRuns(new Set());
    }
  }

  function handleSelectRun(runId: string, checked: boolean) {
    const newSelected = new Set(selectedRuns);
    if (checked) {
      newSelected.add(runId);
    } else {
      newSelected.delete(runId);
    }
    setSelectedRuns(newSelected);
  }

  const allSelected = sortedRuns.length > 0 && sortedRuns.every(r => selectedRuns.has(r.id));
  const someSelected = selectedRuns.size > 0 && !allSelected;

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return (
        <span className="ml-1 text-gray-400">
          <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </span>
      );
    }
    return (
      <span className="ml-1">
        {sortDirection === 'asc' ? (
          <svg className="w-4 h-4 inline text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 inline text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </span>
    );
  }

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mb-8"
      >
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Run History
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View all agent execution runs and their details
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mb-6 flex gap-4"
      >
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by Agent
          </label>
          <select
            value={filterAgentId}
            onChange={(e) => setFilterAgentId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Agents</option>
            {Array.from(agents.values()).map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="error">Error</option>
            </select>
          </div>
        </motion.div>

      {/* Bulk Actions Bar */}
      {selectedRuns.size > 0 && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
            {selectedRuns.size} run{selectedRuns.size !== 1 ? 's' : ''} selected
          </span>
          <MorphButton
            variant="danger"
            onClick={handleBulkDelete}
            disabled={deletingRun === 'bulk'}
          >
            {deletingRun === 'bulk' ? 'Deleting...' : `Delete ${selectedRuns.size} run${selectedRuns.size !== 1 ? 's' : ''}`}
          </MorphButton>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading runs...</p>
        </div>
      ) : sortedRuns.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No runs found</p>
        </div>
        ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  onClick={() => handleSort('agent')}
                >
                  Agent <SortIcon field="agent" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  onClick={() => handleSort('model')}
                >
                  Model <SortIcon field="model" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon field="status" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  onClick={() => handleSort('tokens')}
                >
                  Tokens <SortIcon field="tokens" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  onClick={() => handleSort('toolCalls')}
                >
                  Tool Calls <SortIcon field="toolCalls" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  onClick={() => handleSort('duration')}
                >
                  Duration <SortIcon field="duration" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  onClick={() => handleSort('created')}
                >
                  Created <SortIcon field="created" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedRuns.map((run, index) => (
                  <motion.tr
                    key={run.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.02, ease: [0.16, 1, 0.3, 1] }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                  >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedRuns.has(run.id)}
                      onChange={(e) => handleSelectRun(run.id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {agents.get(run.agentId)?.name || run.agentId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {run.modelUsed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      run.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      run.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {run.totalTokens.totalTokens.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {run.totalToolCalls}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {formatDuration(run.createdAt, run.completedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(run.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-3">
                      <Link
                        href={`/dashboard/runs/${run.id}`}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDeleteRun(run.id)}
                        disabled={deletingRun === run.id}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete run"
                      >
                        {deletingRun === run.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                  </motion.tr>
                ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}