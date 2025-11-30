'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  defaultModel: string;
  allowedTools: string[];
  tags: string[];
  settings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

interface Model {
  id: string;
  displayName: string;
  provider: string;
  strengths?: string[];
  cost?: {
    inputPer1M: number;
    outputPer1M: number;
  };
}

interface Tool {
  name: string;
  description: string;
}

interface PromptVersion {
  id: string;
  agentId: string;
  version: number;
  systemPrompt: string;
  commitMessage: string | null;
  createdAt: Date;
}

export default function EditAgentPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    defaultModel: '',
    allowedTools: [] as string[],
    tags: [] as string[],
    settings: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
    },
  });

  const [tagInput, setTagInput] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [memoryContent, setMemoryContent] = useState<string>('');
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [forking, setForking] = useState(false);
  const [forkName, setForkName] = useState('');
  const [forkCopyMemory, setForkCopyMemory] = useState(true);

  useEffect(() => {
    loadAgent();
    loadModels();
    loadTools();
    loadPromptVersions();
    loadMemory();
  }, [agentId]);

  async function loadAgent() {
    try {
      const response = await fetch(`/api/agents/${agentId}`);
      if (!response.ok) {
        throw new Error('Failed to load agent');
      }
      const agent: Agent = await response.json();
      setFormData({
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        defaultModel: agent.defaultModel,
        allowedTools: agent.allowedTools,
        tags: agent.tags,
        settings: {
          temperature: agent.settings?.temperature ?? 0.7,
          maxTokens: agent.settings?.maxTokens ?? 4096,
          topP: agent.settings?.topP ?? 1.0,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent');
    } finally {
      setLoading(false);
    }
  }

  async function loadModels() {
    try {
      const response = await fetch('/api/models');
      if (response.ok) {
        const data = await response.json();
        setModels(data);
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  }

  async function loadTools() {
    try {
      const response = await fetch('/api/tools');
      if (response.ok) {
        const data = await response.json();
        setTools(data);
      }
    } catch (err) {
      console.error('Failed to load tools:', err);
    }
  }

  async function loadPromptVersions() {
    try {
      const response = await fetch(`/api/agents/${agentId}/versions`);
      if (response.ok) {
        const data = await response.json();
        setPromptVersions(data);
      }
    } catch (err) {
      console.error('Failed to load prompt versions:', err);
    }
  }

  async function loadMemory() {
    setMemoryLoading(true);
    setMemoryError(null);
    try {
      const response = await fetch(`/api/agents/${agentId}/memory`);
      if (response.ok) {
        const data = await response.json();
        setMemoryContent(data.content || '');
      } else {
        // Memory file doesn't exist yet - that's okay
        setMemoryContent('');
      }
    } catch (err) {
      console.error('Failed to load memory:', err);
      setMemoryError(err instanceof Error ? err.message : 'Failed to load memory');
    } finally {
      setMemoryLoading(false);
    }
  }

  async function saveMemory() {
    setMemorySaving(true);
    setMemoryError(null);
    try {
      const response = await fetch(`/api/agents/${agentId}/memory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: memoryContent }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save memory');
      }

      alert('Memory saved successfully!');
    } catch (err) {
      setMemoryError(err instanceof Error ? err.message : 'Failed to save memory');
    } finally {
      setMemorySaving(false);
    }
  }

  async function loadPromptVersion(version: number) {
    try {
      const response = await fetch(`/api/agents/${agentId}/versions/${version}`);
      if (response.ok) {
        const versionData: PromptVersion = await response.json();
        setFormData(prev => ({
          ...prev,
          systemPrompt: versionData.systemPrompt,
        }));
        setSelectedVersion(version);
      }
    } catch (err) {
      console.error('Failed to load prompt version:', err);
    }
  }

  async function revertToVersion(version: number) {
    if (!confirm(`Revert to version ${version}? This will update the current prompt.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/agents/${agentId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });

      if (!response.ok) {
        throw new Error('Failed to revert version');
      }

      const agent = await response.json();
      setFormData(prev => ({
        ...prev,
        systemPrompt: agent.systemPrompt,
      }));
      setSelectedVersion(null);
      await loadPromptVersions();
      alert(`Reverted to version ${version}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert version');
    }
  }

  function handleToolToggle(toolName: string) {
    setFormData(prev => ({
      ...prev,
      allowedTools: prev.allowedTools.includes(toolName)
        ? prev.allowedTools.filter(t => t !== toolName)
        : [...prev.allowedTools, toolName],
    }));
  }

  function handleAddTag() {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  }

  function handleRemoveTag(tag: string) {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          commitMessage: commitMessage.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update agent');
      }

      // Refresh versions and clear commit message
      setCommitMessage('');
      setSelectedVersion(null);
      await loadPromptVersions();

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent');
    } finally {
      setSaving(false);
    }
  }

  function handleForkClick() {
    setForking(true);
    setForkName(`${formData.name} (Copy)`);
    setForkCopyMemory(true);
  }

  async function handleForkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!forkName.trim()) {
      return;
    }

    try {
      const response = await fetch(`/api/agents/${agentId}/fork`, {
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
      setForking(false);
      setForkName('');
      router.push(`/dashboard/chat/${newAgent.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fork agent');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Edit Agent
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Update your agent configuration
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description *
            </label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* System Prompt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                System Prompt *
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowVersionHistory(!showVersionHistory)}
                  className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  {showVersionHistory ? 'Hide' : 'Show'} History ({promptVersions.length})
                </button>
                {selectedVersion !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVersion(null);
                      loadAgent();
                    }}
                    className="text-xs px-3 py-1 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-300 dark:hover:bg-blue-700 transition"
                  >
                    Viewing v{selectedVersion} - Click to return to current
                  </button>
                )}
              </div>
            </div>
            
            {showVersionHistory && promptVersions.length > 0 && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Version History</h4>
                <div className="space-y-2">
                  {promptVersions.map((version) => (
                    <div
                      key={version.id}
                      className={`p-3 rounded border ${
                        selectedVersion === version.version
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              Version {version.version}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(version.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {version.commitMessage && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 italic">
                              "{version.commitMessage}"
                            </p>
                          )}
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-mono line-clamp-2">
                            {version.systemPrompt.substring(0, 100)}
                            {version.systemPrompt.length > 100 ? '...' : ''}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            type="button"
                            onClick={() => loadPromptVersion(version.version)}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => revertToVersion(version.version)}
                            className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                          >
                            Revert
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <textarea
              required
              rows={6}
              value={formData.systemPrompt}
              onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
            />
            
            {/* Commit Message */}
            <div className="mt-2">
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Commit Message (optional) - Describe what changed in this prompt
              </label>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="e.g., Added more specific instructions for tool usage"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              />
            </div>
          </div>

          {/* Default Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Default Model *
            </label>
            <select
              required
              value={formData.defaultModel}
              onChange={(e) => setFormData(prev => ({ ...prev, defaultModel: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {models.map((model) => {
                const hasToolUse = model.strengths?.includes('tool-use') ?? false;
                const isFree = !model.cost || (model.cost.inputPer1M === 0 && model.cost.outputPer1M === 0);
                
                return (
                  <option key={model.id} value={model.id}>
                    {model.displayName} ({model.provider}){hasToolUse ? ' 🔧' : ''}{isFree ? ' 🆓' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Allowed Tools */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Allowed Tools
            </label>
            <div className="space-y-2">
              {tools.map((tool) => (
                <label key={tool.name} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allowedTools.includes(tool.name)}
                    onChange={() => handleToolToggle(tool.name)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-gray-900 dark:text-white font-medium">{tool.name}</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{tool.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Model Settings
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Temperature (0-2)
                </label>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formData.settings.temperature}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, temperature: parseFloat(e.target.value) || 0.7 }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Max Tokens
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.settings.maxTokens}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, maxTokens: parseInt(e.target.value) || 4096 }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Top P (0-1)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.settings.topP}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, topP: parseFloat(e.target.value) || 1.0 }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Structured Memory Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Structured Memory
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This memory file is automatically updated after each conversation. You can manually edit it here.
                  The content is included in every message sent to the model.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={loadMemory}
                  disabled={memoryLoading}
                  className="text-sm px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {memoryLoading ? 'Loading...' : 'Reload'}
                </button>
                <button
                  type="button"
                  onClick={saveMemory}
                  disabled={memorySaving}
                  className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {memorySaving ? 'Saving...' : 'Save Memory'}
                </button>
              </div>
            </div>
            
            {memoryError && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded-lg text-sm">
                {memoryError}
              </div>
            )}
            
            <textarea
              rows={12}
              value={memoryContent}
              onChange={(e) => setMemoryContent(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
              placeholder="Memory file will load here... If empty, the memory file doesn't exist yet and will be created after the first conversation."
            />
            
            {memoryContent && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {memoryContent.split('\n').length} lines
              </p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Add a tag"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm flex items-center gap-2"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleForkClick}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Fork Agent
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Fork Agent Modal */}
      {forking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Fork Agent
            </h2>
            <form onSubmit={handleForkSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Agent Name *
                </label>
                <input
                  type="text"
                  required
                  value={forkName}
                  onChange={(e) => setForkName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter name for forked agent"
                  autoFocus
                />
              </div>
              <div className="mb-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forkCopyMemory}
                    onChange={(e) => setForkCopyMemory(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Copy structured memory
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                  If unchecked, the new agent will start with empty memory
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setForking(false);
                    setForkName('');
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Fork Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

