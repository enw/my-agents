'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AnimatedCard from '../components/AnimatedCard';
import MorphButton from '../components/MorphButton';
import { motion } from 'framer-motion';

interface Agent {
  id: string;
  name: string;
  description: string;
  defaultModel: string;
  allowedTools: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  latestVersion?: string; // Latest agent version from most recent run
  promptVersion?: number; // Current prompt version
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
      const agentsData = await response.json();
      
      // Fetch latest version for each agent
      const agentsWithVersions = await Promise.all(
        agentsData.map(async (agent: Agent) => {
          try {
            // Get latest run for this agent
            const runsResponse = await fetch(`/api/runs?agentId=${agent.id}&limit=1`);
            if (runsResponse.ok) {
              const runs = await runsResponse.json();
              if (runs.length > 0 && runs[0].agentVersion) {
                return { ...agent, latestVersion: runs[0].agentVersion };
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

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mb-8"
      >
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Agent Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your AI agents and view execution history
        </p>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded-lg"
        >
          {error}
        </motion.div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <AnimatedCard className="text-center py-16">
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No agents yet. Create your first agent to get started!
          </p>
          <MorphButton variant="primary" onClick={() => router.push('/dashboard/new')}>
            Create Your First Agent
          </MorphButton>
        </AnimatedCard>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {agents.map((agent, index) => (
            <AnimatedCard key={agent.id} delay={index * 0.02} className="p-3">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1 flex-1 pr-1">
                  {agent.name}
                </h3>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => router.push(`/dashboard/chat/${agent.id}`)}
                    className="text-accent hover:text-accent-hover text-xs transition-colors duration-150"
                    title="Chat with agent"
                  >
                    💬
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/edit/${agent.id}`)}
                    className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-xs transition-colors duration-150"
                    title="Edit agent"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(agent.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs transition-colors duration-150"
                    title="Delete agent"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-xs mb-2 line-clamp-2 min-h-[2.5rem]">
                {agent.description}
              </p>
              {agent.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {agent.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 bg-accent-light dark:bg-blue-900/30 text-accent dark:text-blue-300 text-[10px] rounded border border-accent/20 transition-colors duration-150"
                    >
                      {tag}
                    </span>
                  ))}
                  {agent.tags.length > 2 && (
                    <span className="px-1.5 py-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                      +{agent.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
              <div className="text-[10px] text-gray-500 dark:text-gray-500 space-y-0.5 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="truncate" title={agent.defaultModel}>
                  <span className="text-gray-400 dark:text-gray-500">M: </span>
                  <span className="font-mono">{agent.defaultModel.split(':').pop()}</span>
                </div>
                <div>
                  <span className="text-gray-400 dark:text-gray-500">Tools: </span>
                  <span>{agent.allowedTools.length}</span>
                </div>
                {agent.latestVersion && (
                  <div className="truncate" title={agent.latestVersion}>
                    <span className="text-gray-400 dark:text-gray-500">V: </span>
                    <span className="font-mono text-[9px] text-gray-600 dark:text-gray-400">
                      {agent.latestVersion}
                    </span>
                  </div>
                )}
                {!agent.latestVersion && agent.promptVersion && (
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">Pv{agent.promptVersion}</span>
                  </div>
                )}
              </div>
            </AnimatedCard>
          ))}
        </div>
      )}
    </div>
  );
}