'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

interface Model {
  id: string;
  provider: string;
  displayName: string;
  size?: string;
  contextWindow: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  cost?: {
    inputPer1M: number;
    outputPer1M: number;
  };
  speed?: number;
  strengths?: string[];
  lastUsed?: Date;
  metadata: Record<string, unknown>;
}

type SortField = 'name' | 'provider' | 'contextWindow' | 'cost' | 'speed';
type SortDirection = 'asc' | 'desc';

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    loadModels();
  }, []);

  async function loadModels() {
    setLoading(true);
    try {
      const response = await fetch('/api/models');
      if (!response.ok) {
        throw new Error('Failed to load models');
      }
      const data = await response.json();
      setModels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }

  const providers = useMemo(() => Array.from(new Set(models.map(m => m.provider))), [models]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

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

  function formatCost(cost?: { inputPer1M: number | string; outputPer1M: number | string }): string {
    if (!cost) return '—';
    const inputPer1M = typeof cost.inputPer1M === 'string' ? parseFloat(cost.inputPer1M) : cost.inputPer1M;
    const outputPer1M = typeof cost.outputPer1M === 'string' ? parseFloat(cost.outputPer1M) : cost.outputPer1M;
    
    if (isNaN(inputPer1M) || isNaN(outputPer1M)) {
      return '—';
    }
    
    return `$${inputPer1M.toFixed(2)}/$1M`;
  }

  const filteredAndSortedModels = useMemo(() => {
    let filtered = filterProvider
      ? models.filter(m => m.provider === filterProvider)
      : models;

    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.displayName.toLowerCase();
          bVal = b.displayName.toLowerCase();
          break;
        case 'provider':
          aVal = a.provider.toLowerCase();
          bVal = b.provider.toLowerCase();
          break;
        case 'contextWindow':
          aVal = a.contextWindow;
          bVal = b.contextWindow;
          break;
        case 'cost':
          aVal = a.cost ? (typeof a.cost.inputPer1M === 'string' ? parseFloat(a.cost.inputPer1M) : a.cost.inputPer1M) : Infinity;
          bVal = b.cost ? (typeof b.cost.inputPer1M === 'string' ? parseFloat(b.cost.inputPer1M) : b.cost.inputPer1M) : Infinity;
          break;
        case 'speed':
          aVal = a.speed || 0;
          bVal = b.speed || 0;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [models, filterProvider, sortField, sortDirection]);

  return (
    <div className="p-3">
      {/* Page Header - Compact */}
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-medium text-text-primary">
          Model Browser
        </h1>
        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
          className="px-2 py-1 text-xs bg-bg-subtle text-text-primary border border-border-subtle rounded-sm focus:outline-none focus:border-accent-blue"
          style={{ height: '28px' }}
        >
          <option value="">All Providers</option>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-2 p-1.5 text-xs bg-accent-red/10 border border-accent-red/30 text-accent-red rounded-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-accent-blue"></div>
          <p className="mt-2 text-xs text-text-muted">Loading models...</p>
        </div>
      ) : filteredAndSortedModels.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-text-muted">No models found</p>
        </div>
      ) : (
        <div className="bg-bg-elevated border border-border-subtle rounded-sm overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-bg-subtle border-b border-border-subtle">
              <tr>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('name')}
                  style={{ height: '30px' }}
                >
                  Model <SortIcon field="name" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('provider')}
                >
                  Provider <SortIcon field="provider" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('contextWindow')}
                >
                  Context <SortIcon field="contextWindow" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('cost')}
                >
                  Cost <SortIcon field="cost" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('speed')}
                >
                  Speed <SortIcon field="speed" />
                </th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
                  Capabilities
                </th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
                  ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredAndSortedModels.map((model) => (
                <tr
                  key={model.id}
                  className="hover:bg-bg-hover transition"
                  style={{ height: '32px' }}
                >
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-text-primary">
                        {model.displayName}
                      </span>
                      {model.size && (
                        <span className="px-1 py-0.5 text-[10px] bg-bg-subtle text-text-muted border border-border-subtle rounded-sm">
                          {model.size}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <span className="text-xs text-text-secondary">
                      {model.provider}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <span className="text-xs text-text-secondary">
                      {model.contextWindow.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <span className="text-xs text-text-secondary">
                      {formatCost(model.cost)}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    {model.speed ? (
                      <span className="text-xs text-text-secondary">
                        ~{model.speed}/s
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      {model.supportsTools && (
                        <span className="px-1 py-0.5 text-[10px] bg-accent-green/10 text-accent-green border border-accent-green/20 rounded-sm">
                          Tools
                        </span>
                      )}
                      {model.supportsStreaming && (
                        <span className="px-1 py-0.5 text-[10px] bg-accent-purple/10 text-accent-purple border border-accent-purple/20 rounded-sm">
                          Stream
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <code className="text-xs text-text-muted font-mono">
                      {model.id.split(':').pop()}
                    </code>
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

