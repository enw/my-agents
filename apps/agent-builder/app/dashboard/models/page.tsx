'use client';

import { useEffect, useState } from 'react';
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

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterProvider, setFilterProvider] = useState<string>('');

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

  const providers = Array.from(new Set(models.map(m => m.provider)));
  const filteredModels = filterProvider
    ? models.filter(m => m.provider === filterProvider)
    : models;

  function formatCost(cost?: { inputPer1M: number | string; outputPer1M: number | string }): string {
    if (!cost) return 'N/A';
    const inputPer1M = typeof cost.inputPer1M === 'string' ? parseFloat(cost.inputPer1M) : cost.inputPer1M;
    const outputPer1M = typeof cost.outputPer1M === 'string' ? parseFloat(cost.outputPer1M) : cost.outputPer1M;
    
    // Handle NaN cases
    if (isNaN(inputPer1M) || isNaN(outputPer1M)) {
      return 'N/A';
    }
    
    return `$${inputPer1M.toFixed(2)}/$1M in, $${outputPer1M.toFixed(2)}/$1M out`;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Model Browser
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Browse available AI models and their capabilities
        </p>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Filter by Provider
        </label>
        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading models...</p>
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No models found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModels.map((model) => (
            <div
              key={model.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {model.displayName}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {model.provider}
                  </p>
                </div>
                {model.size && (
                  <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                    {model.size}
                  </span>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Context Window:</span>
                  <span className="ml-2 text-gray-900 dark:text-white font-medium">
                    {model.contextWindow.toLocaleString()} tokens
                  </span>
                </div>

                {model.cost && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Cost:</span>
                    <span className="ml-2 text-gray-900 dark:text-white text-xs">
                      {formatCost(model.cost)}
                    </span>
                  </div>
                )}

                {model.speed && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Speed:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      ~{model.speed} tokens/sec
                    </span>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {model.supportsTools && (
                    <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                      Tools
                    </span>
                  )}
                  {model.supportsStreaming && (
                    <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded">
                      Streaming
                    </span>
                  )}
                </div>

                {model.strengths && model.strengths.length > 0 && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Strengths:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {model.strengths.map((strength, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                        >
                          {strength}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {model.lastUsed && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Last used: {new Date(model.lastUsed).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <code className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                  {model.id}
                </code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

