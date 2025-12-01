'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AgentTemplates, { AgentTemplate, AGENT_TEMPLATES } from '../../components/AgentTemplates';
import { motion, AnimatePresence } from 'framer-motion';

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

type FormStep = 'template' | 'basic' | 'advanced';

export default function NewAgentPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<FormStep>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
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
    initialMemory: '',
  });

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    loadModels();
    loadTools();
  }, []);

  async function loadModels() {
    try {
      const response = await fetch('/api/models');
      if (response.ok) {
        const data = await response.json();
        setModels(data);
        if (data.length > 0 && !formData.defaultModel) {
          setFormData(prev => ({ ...prev, defaultModel: data[0].id }));
        }
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

  function handleTemplateSelect(template: AgentTemplate) {
    setSelectedTemplate(template);
    
    // Apply template defaults
    setFormData(prev => ({
      ...prev,
      name: template.id === 'custom' ? '' : template.name,
      description: template.id === 'custom' ? '' : template.description,
      systemPrompt: template.systemPrompt,
      allowedTools: template.defaultTools,
      tags: template.tags,
    }));
    
    // Move to basic step
    setCurrentStep('basic');
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
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create agent');
      }

      const agent = await response.json();
      router.push(`/dashboard/chat/${agent.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setLoading(false);
    }
  }

  function canProceedToAdvanced(): boolean {
    return formData.name.trim() !== '' && 
           formData.description.trim() !== '' && 
           formData.systemPrompt.trim() !== '' &&
           formData.defaultModel !== '';
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
            Create New Agent
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {currentStep === 'template' && 'Choose a template to get started, or create a custom agent'}
            {currentStep === 'basic' && 'Configure the basic settings for your agent'}
            {currentStep === 'advanced' && 'Fine-tune advanced options (optional)'}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className={`flex-1 h-2 rounded-full ${
              currentStep !== 'template' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
            }`} />
            <div className={`flex-1 h-2 rounded-full ${
              currentStep === 'advanced' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
            }`} />
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span className={currentStep === 'template' ? 'font-semibold text-blue-600 dark:text-blue-400' : ''}>
              Choose Template
            </span>
            <span className={currentStep === 'basic' ? 'font-semibold text-blue-600 dark:text-blue-400' : ''}>
              Basic Info
            </span>
            <span className={currentStep === 'advanced' ? 'font-semibold text-blue-600 dark:text-blue-400' : ''}>
              Advanced
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {currentStep === 'template' && (
            <motion.div
              key="template"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Choose a Template
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Start with a pre-configured agent or create your own from scratch.
              </p>
              <AgentTemplates
                onSelectTemplate={handleTemplateSelect}
                selectedTemplateId={selectedTemplate?.id}
              />
            </motion.div>
          )}

          {currentStep === 'basic' && (
            <motion.form
              key="basic"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (canProceedToAdvanced()) {
                  setCurrentStep('advanced');
                }
              }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Basic Information
                </h2>
                <button
                  type="button"
                  onClick={() => setCurrentStep('template')}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  ← Change Template
                </button>
              </div>

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
                  placeholder="e.g., Code Assistant"
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
                  placeholder="Brief description of what this agent does"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  System Prompt *
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">
                    (This defines how your agent behaves)
                  </span>
                </label>
                <textarea
                  required
                  rows={6}
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                  placeholder="You are a helpful AI assistant. You help users with..."
                />
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
                  <option value="">Select a model...</option>
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

              {/* Navigation */}
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
                  onClick={async () => {
                    if (canProceedToAdvanced()) {
                      setLoading(true);
                      setError(null);
                      try {
                        const response = await fetch('/api/agents', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(formData),
                        });
                        if (!response.ok) {
                          const errorData = await response.json();
                          throw new Error(errorData.error || 'Failed to create agent');
                        }
                        const agent = await response.json();
                        router.push(`/dashboard/chat/${agent.id}`);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to create agent');
                        setLoading(false);
                      }
                    }
                  }}
                  disabled={!canProceedToAdvanced() || loading}
                  className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? 'Creating...' : 'Skip Advanced Options'}
                </button>
                <button
                  type="submit"
                  disabled={!canProceedToAdvanced()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Continue to Advanced →
                </button>
              </div>
            </motion.form>
          )}

          {currentStep === 'advanced' && (
            <motion.form
              key="advanced"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleSubmit}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Advanced Options
                </h2>
                <button
                  type="button"
                  onClick={() => setCurrentStep('basic')}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  ← Back to Basic
                </button>
              </div>

              {/* Allowed Tools */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Allowed Tools
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">
                    (Select which tools this agent can use)
                  </span>
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  {tools.map((tool) => (
                    <label key={tool.name} className="flex items-start space-x-3 cursor-pointer p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                      <input
                        type="checkbox"
                        checked={formData.allowedTools.includes(tool.name)}
                        onChange={() => handleToolToggle(tool.name)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="text-gray-900 dark:text-white font-medium">{tool.name}</span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{tool.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Collapsible Advanced Settings */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <span className="font-medium text-gray-900 dark:text-white">
                    Model Settings & Memory
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                    {/* Settings */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Model Settings
                      </label>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Temperature (0-2)
                            <span className="block text-gray-500 text-xs mt-1">0 = focused, 2 = creative</span>
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

                    {/* Structured Memory (Optional) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Initial Structured Memory (Optional)
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Pre-populate the agent's memory with key information. This will be included in every conversation.
                        The memory is automatically updated after conversations, but you can set initial context here.
                      </p>
                      <textarea
                        rows={6}
                        value={formData.initialMemory}
                        onChange={(e) => setFormData(prev => ({ ...prev, initialMemory: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                        placeholder={`# Conversation Memory\n\n## KEY CONVO DATA\n[Important facts, decisions, user preferences]\n\n## CURRENT TOPIC\n[Current conversation focus]`}
                      />
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
                          placeholder="Add a tag (e.g., coding, research)"
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
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep('basic')}
                  className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? 'Creating...' : 'Create Agent'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
