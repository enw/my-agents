'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AnimatedCard from '../components/AnimatedCard';
import MorphButton from '../components/MorphButton';
import OnboardingModal, { hasCompletedOnboarding } from '../components/OnboardingModal';

interface Agent {
  id: string;
  name: string;
  description: string;
  defaultModel: string;
  allowedTools: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  latestVersion?: string;
  promptVersion?: number;
  lastRun?: {
    status: 'running' | 'completed' | 'error';
    createdAt: string;
  };
}

type SortField = 'name' | 'model' | 'tools' | 'tags' | 'lastRun' | 'version';
type SortDirection = 'asc' | 'desc';

export default function Dashboard() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forkingAgent, setForkingAgent] = useState<string | null>(null);
  const [forkName, setForkName] = useState('');
  const [forkCopyMemory, setForkCopyMemory] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    loadAgents();
    // Check if user has completed onboarding
    if (!hasCompletedOnboarding() && agents.length === 0) {
      // Only show if no agents exist (first visit)
      setShowOnboarding(true);
    }
  }, []);

  async function loadAgents() {
    try {
      setLoading(true);
      const response = await fetch('/api/agents');
      if (!response.ok) {
        throw new Error('Failed to load agents');
      }
      const agentsData = await response.json();
      
      // Fetch latest version and last run for each agent
      const agentsWithVersions = await Promise.all(
        agentsData.map(async (agent: Agent) => {
          try {
            // Get latest run for this agent
            const runsResponse = await fetch(`/api/runs?agentId=${agent.id}&limit=1`);
            if (runsResponse.ok) {
              const runs = await runsResponse.json();
              if (runs.length > 0) {
                const latestRun = runs[0];
                return {
                  ...agent,
                  latestVersion: latestRun.agentVersion,
                  lastRun: {
                    status: latestRun.status,
                    createdAt: latestRun.createdAt,
                  },
                };
              }
            }
            
            // Get prompt versions to show current prompt version
            const versionsResponse = await fetch(`/api/agents/${agent.id}/versions`);
            if (versionsResponse.ok) {
              const versions = await versionsResponse.json();
              if (versions.length > 0) {
                const latestPromptVersion = versions[0].version;
                return { ...agent, promptVersion: latestPromptVersion };
              }
            }
          } catch (err) {
            console.error(`Failed to load version for agent ${agent.id}:`, err);
          }
          return agent;
        })
      );
      
      setAgents(agentsWithVersions);
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

  function handleForkClick(agentId: string, agentName: string) {
    setForkingAgent(agentId);
    setForkName(`${agentName} (Copy)`);
    setForkCopyMemory(true);
  }

  async function handleForkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!forkingAgent || !forkName.trim()) {
      return;
    }

    try {
      const response = await fetch(`/api/agents/${forkingAgent}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: forkName.trim(),
          copyMemory: forkCopyMemory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fork agent');
      }

      const newAgent = await response.json();
      setForkingAgent(null);
      setForkName('');
      await loadAgents();
      router.push(`/dashboard/chat/${newAgent.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to fork agent');
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

  function formatLastRun(lastRun?: Agent['lastRun']) {
    if (!lastRun) return '—';
    const date = new Date(lastRun.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Get unique tags and providers for filters
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    agents.forEach(agent => agent.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [agents]);

  const allProviders = useMemo(() => {
    const providerSet = new Set<string>();
    agents.forEach(agent => {
      const provider = agent.defaultModel.split(':')[0];
      if (provider) providerSet.add(provider);
    });
    return Array.from(providerSet).sort();
  }, [agents]);

  // Filter and sort agents
  const filteredAndSortedAgents = useMemo(() => {
    let filtered = agents.filter(agent => {
      const matchesSearch = !searchQuery || 
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = !filterTag || agent.tags.includes(filterTag);
      const matchesProvider = !filterProvider || 
        agent.defaultModel.toLowerCase().startsWith(filterProvider.toLowerCase());
      return matchesSearch && matchesTag && matchesProvider;
    });

    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'model':
          aVal = a.defaultModel.toLowerCase();
          bVal = b.defaultModel.toLowerCase();
          break;
        case 'tools':
          aVal = a.allowedTools.length;
          bVal = b.allowedTools.length;
          break;
        case 'tags':
          aVal = a.tags.join(',').toLowerCase();
          bVal = b.tags.join(',').toLowerCase();
          break;
        case 'lastRun':
          aVal = a.lastRun?.createdAt ? new Date(a.lastRun.createdAt).getTime() : 0;
          bVal = b.lastRun?.createdAt ? new Date(b.lastRun.createdAt).getTime() : 0;
          break;
        case 'version':
          aVal = a.latestVersion || a.promptVersion || 0;
          bVal = b.latestVersion || b.promptVersion || 0;
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
  }, [agents, searchQuery, filterTag, filterProvider, sortField, sortDirection]);

  async function handleQuickStart() {
    try {
      // Load available models first
      const modelsResponse = await fetch('/api/models');
      if (!modelsResponse.ok) {
        throw new Error('Failed to load models');
      }
      const models = await modelsResponse.json();
      
      // Use first available model, or empty string if none available
      const defaultModel = models.length > 0 ? models[0].id : '';

      // Create a quick start agent with sensible defaults
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'General Assistant',
          description: 'A helpful AI assistant that can answer questions and use basic tools',
          systemPrompt: 'You are a helpful AI assistant. You help users with questions, tasks, and provide clear, accurate information. When you need to use tools, explain what you\'re doing.',
          defaultModel: defaultModel,
          allowedTools: ['http', 'file'], // Basic tools only
          tags: ['general', 'quick-start'],
          settings: {
            temperature: 0.7,
            maxTokens: 4096,
            topP: 1.0,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create quick start agent');
      }

      const agent = await response.json();
      await loadAgents();
      router.push(`/dashboard/chat/${agent.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create quick start agent');
    }
  }

  return (
    <div className="p-3">
      {/* Page Header - Compact */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-text-primary">
            Agent Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-2 py-1 text-xs bg-bg-subtle text-text-primary border border-border-subtle rounded-sm focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/40"
            style={{ height: '28px', width: '200px' }}
          />
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="px-2 py-1 text-xs bg-bg-subtle text-text-primary border border-border-subtle rounded-sm focus:outline-none focus:border-accent-blue"
            style={{ height: '28px' }}
          >
            <option value="">All Tags</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className="px-2 py-1 text-xs bg-bg-subtle text-text-primary border border-border-subtle rounded-sm focus:outline-none focus:border-accent-blue"
            style={{ height: '28px' }}
          >
            <option value="">All Providers</option>
            {allProviders.map(provider => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </select>
          <button
            onClick={() => router.push('/dashboard/new')}
            className="px-2 py-1 text-xs bg-accent-blue text-text-inverse rounded-sm hover:opacity-90 transition"
            style={{ height: '28px' }}
          >
            + New Agent
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-2 p-1.5 text-xs bg-accent-red/10 border border-accent-red/30 text-accent-red rounded-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-accent-blue"></div>
          <p className="mt-2 text-xs text-text-muted">Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-8 bg-bg-elevated border border-border-subtle rounded-sm">
          <div className="max-w-md mx-auto">
            <h2 className="text-sm font-medium text-text-primary mb-2">
              Welcome to Agent Builder!
            </h2>
            <p className="text-xs text-text-muted mb-3">
              Create your first AI agent to get started.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => router.push('/dashboard/new')}
                className="px-3 py-1 text-xs bg-accent-blue text-text-inverse rounded-sm hover:opacity-90 transition"
              >
                Create Agent
              </button>
              <button
                onClick={() => setShowOnboarding(true)}
                className="px-3 py-1 text-xs bg-bg-subtle text-text-secondary border border-border-subtle rounded-sm hover:bg-bg-hover transition"
              >
                Tour
              </button>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Or try a <button 
                onClick={() => handleQuickStart()}
                className="text-accent-blue hover:underline"
              >
                Quick Start
              </button>
            </p>
          </div>
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
                  Agent <SortIcon field="name" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('model')}
                >
                  Default Model <SortIcon field="model" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('tools')}
                >
                  Tools <SortIcon field="tools" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('tags')}
                >
                  Tags <SortIcon field="tags" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('lastRun')}
                >
                  Last Run <SortIcon field="lastRun" />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide cursor-pointer hover:bg-bg-hover transition group"
                  onClick={() => handleSort('version')}
                >
                  Version <SortIcon field="version" />
                </th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredAndSortedAgents.map((agent) => (
                <tr
                  key={agent.id}
                  className="hover:bg-bg-hover transition"
                  style={{ height: '32px' }}
                >
                  <td className="px-2 py-1">
                    <div>
                      <div className="text-xs font-medium text-text-primary">
                        {agent.name}
                      </div>
                      <div className="text-xs text-text-muted line-clamp-1">
                        {agent.description}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <span className="text-xs text-text-secondary font-mono">
                      {agent.defaultModel.split(':').pop()}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <span className="text-xs text-text-secondary">
                      {agent.allowedTools.length}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      {agent.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="px-1 py-0.5 text-[10px] bg-bg-subtle text-text-secondary border border-border-subtle rounded-sm"
                        >
                          {tag}
                        </span>
                      ))}
                      {agent.tags.length > 2 && (
                        <span className="text-[10px] text-text-muted">
                          +{agent.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    {agent.lastRun ? (
                      <div className="flex items-center gap-1">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                          agent.lastRun.status === 'completed' ? 'bg-accent-green' :
                          agent.lastRun.status === 'error' ? 'bg-accent-red' :
                          'bg-accent-amber animate-pulse'
                        }`} />
                        <span className="text-xs text-text-secondary">
                          {formatLastRun(agent.lastRun)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {agent.latestVersion ? (
                      <span className="text-xs text-text-secondary font-mono">
                        {agent.latestVersion.substring(0, 8)}
                      </span>
                    ) : agent.promptVersion ? (
                      <span className="text-xs text-text-muted">
                        Pv{agent.promptVersion}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => router.push(`/dashboard/chat/${agent.id}`)}
                        className="p-0.5 text-text-muted hover:text-accent-blue transition"
                        title="Chat"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => router.push(`/dashboard/edit/${agent.id}`)}
                        className="p-0.5 text-text-muted hover:text-text-primary transition"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleForkClick(agent.id, agent.name)}
                        className="p-0.5 text-text-muted hover:text-accent-blue transition"
                        title="Fork"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(agent.id)}
                        className="p-0.5 text-text-muted hover:text-accent-red transition"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fork Agent Modal */}
      {forkingAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-elevated border border-border-strong rounded-sm shadow-soft p-4 max-w-md w-full mx-4">
            <h2 className="text-sm font-medium text-text-primary mb-3">
              Fork Agent
            </h2>
            <form onSubmit={handleForkSubmit}>
              <div className="mb-3">
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  New Agent Name *
                </label>
                <input
                  type="text"
                  required
                  value={forkName}
                  onChange={(e) => setForkName(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-bg-subtle text-text-primary border border-border-subtle rounded-sm focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/40"
                  style={{ height: '28px' }}
                  placeholder="Enter name for forked agent"
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forkCopyMemory}
                    onChange={(e) => setForkCopyMemory(e.target.checked)}
                    className="rounded border-border-subtle text-accent-blue focus:ring-accent-blue"
                  />
                  <span className="text-xs text-text-secondary">
                    Copy structured memory
                  </span>
                </label>
                <p className="text-xs text-text-muted mt-1 ml-6">
                  If unchecked, the new agent will start with empty memory
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setForkingAgent(null);
                    setForkName('');
                  }}
                  className="flex-1 px-3 py-1.5 text-xs bg-bg-subtle text-text-secondary border border-border-subtle rounded-sm hover:bg-bg-hover transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 text-xs bg-accent-blue text-text-inverse rounded-sm hover:opacity-90 transition"
                >
                  Fork Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={() => setShowOnboarding(false)}
      />
    </div>
  );
}