'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  agentVersion?: string;
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
        <span className="ml-1 text-text-muted opacity-0 group-hover:opacity-100 transition">
          <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </span>
      );
    }
    return (
      <span className="ml-1 text-accent-blue">
        {sortDirection === 'asc' ? (
          <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </span>
    );
  }

  return (
    <div className="p-3">
      {/* Page Header - Compact */}
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-medium text-text-primary">
          Run History
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={filterAgentId}
            onChange={(e) => setFilterAgentId(e.target.value)}
            className="px-2 py-1 text-xs bg-bg-subtle text-text-primary border border-border-subtle rounded-sm focus:outline-none focus:border-accent-blue"
            style={{ height: '28px' }}
          >
            <option value="">All Agents</option>
            {Array.from(agents.values()).map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2 py-1 text-xs bg-bg-subtle text-text-primary border border-border-subtle rounded-sm focus:outline-none focus:border-accent-blue"
            style={{ height: '28px' }}
          >
            <option value="">All Statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedRuns.size > 0 && (
        <div className="mb-2 p-2 bg-bg-elevated border border-border-subtle rounded-sm flex items-center justify-between">
          <span className="text-xs text-text-primary">
            {selectedRuns.size} run{selectedRuns.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleBulkDelete}
              disabled={deletingRun === 'bulk'}
              className="px-2 py-1 text-xs bg-accent-red text-text-inverse rounded-sm hover:opacity-90 disabled:opacity-50 transition"
            >
              {deletingRun === 'bulk' ? 'Deleting...' : `Delete ${selectedRuns.size}`}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-2 p-1.5 text-xs bg-accent-red/10 border border-accent-red/30 text-accent-red rounded-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-accent-blue"></div>
          <p className="mt-2 text-xs text-text-muted">Loading runs...</p>
        </div>
      ) : sortedRuns.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-text-muted">No runs found</p>
        </div>
      ) : (
        <div className="bg-bg-elevated border border-border-subtle rounded-sm overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-bg-subtle border-b border-border-subtle">
              <tr>
                <th className="px-2 py-1.5 text-left" style={{ height: '30px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-border-subtle text-accent-blue focus:ring-accent-blue"
                  />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('agent')}
                >
                  Agent <SortIcon field="agent" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('model')}
                >
                  Model <SortIcon field="model" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon field="status" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('tokens')}
                >
                  Tokens <SortIcon field="tokens" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('toolCalls')}
                >
                  Tool Calls <SortIcon field="toolCalls" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('duration')}
                >
                  Duration <SortIcon field="duration" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('created')}
                >
                  Created <SortIcon field="created" />
                </th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
                  Version
                </th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {sortedRuns.map((run) => (
                <tr
                  key={run.id}
                  className="hover:bg-bg-hover transition"
                  style={{ height: '30px' }}
                >
                  <td className="px-2 py-1 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedRuns.has(run.id)}
                      onChange={(e) => handleSelectRun(run.id, e.target.checked)}
                      className="rounded border-border-subtle text-accent-blue focus:ring-accent-blue"
                    />
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-xs text-text-primary">
                    {agents.get(run.agentId)?.name || run.agentId}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-xs text-text-secondary font-mono">
                    {run.modelUsed.split(':').pop()}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded-sm ${
                      run.status === 'completed' ? 'bg-accent-green/10 text-accent-green' :
                      run.status === 'error' ? 'bg-accent-red/10 text-accent-red' :
                      'bg-accent-amber/10 text-accent-amber'
                    }`}>
                      {run.status}
                      {run.status === 'running' && (
                        <span className="ml-1 inline-block w-1 h-1 rounded-full bg-accent-amber animate-pulse" />
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-xs text-text-secondary">
                    {run.totalTokens.totalTokens.toLocaleString()}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-xs text-text-secondary">
                    {run.totalToolCalls}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-xs text-text-secondary">
                    {formatDuration(run.createdAt, run.completedAt)}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-xs text-text-secondary">
                    {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-xs text-text-secondary">
                    {run.agentVersion ? (
                      <span className="font-mono">{run.agentVersion.substring(0, 8)}</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/runs/${run.id}`}
                        className="text-xs text-accent-blue hover:underline"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDeleteRun(run.id)}
                        disabled={deletingRun === run.id}
                        className="text-xs text-accent-red hover:underline disabled:opacity-50"
                        title="Delete run"
                      >
                        {deletingRun === run.id ? '...' : 'Del'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}