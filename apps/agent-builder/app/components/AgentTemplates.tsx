'use client';

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  defaultTools: string[];
  tags: string[];
  icon: string;
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'general',
    name: 'General Assistant',
    description: 'A helpful AI assistant that can answer questions and use basic tools',
    systemPrompt: 'You are a helpful AI assistant. You help users with questions, tasks, and provide clear, accurate information. When you need to use tools, explain what you\'re doing.',
    defaultTools: ['http', 'file'],
    tags: ['general', 'assistant'],
    icon: '💬',
  },
  {
    id: 'code',
    name: 'Code Assistant',
    description: 'Specialized for programming help with code execution and file operations',
    systemPrompt: 'You are an expert programming assistant. You help users write, debug, and understand code. You can execute code, read files, and search for documentation. Always explain your reasoning and suggest best practices.',
    defaultTools: ['code_executor', 'file', 'shell', 'http'],
    tags: ['coding', 'development'],
    icon: '💻',
  },
  {
    id: 'research',
    name: 'Research Agent',
    description: 'Uses web search and Wikipedia for research tasks and information gathering',
    systemPrompt: 'You are a research assistant. You help users find accurate, up-to-date information by searching the web and Wikipedia. Always cite your sources and verify information when possible.',
    defaultTools: ['web_search', 'wikipedia', 'http', 'file'],
    tags: ['research', 'information'],
    icon: '🔍',
  },
  {
    id: 'analyst',
    name: 'Data Analyst',
    description: 'Analyzes data, executes code, and helps with data processing tasks',
    systemPrompt: 'You are a data analyst assistant. You help users analyze data, create visualizations, process files, and answer questions about datasets. You can execute Python code for data analysis.',
    defaultTools: ['code_executor', 'file', 'http'],
    tags: ['data', 'analysis'],
    icon: '📊',
  },
  {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Start from scratch with full control',
    systemPrompt: '',
    defaultTools: [],
    tags: [],
    icon: '⚙️',
  },
];

interface AgentTemplatesProps {
  onSelectTemplate: (template: AgentTemplate) => void;
  selectedTemplateId?: string;
}

export default function AgentTemplates({ onSelectTemplate, selectedTemplateId }: AgentTemplatesProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {AGENT_TEMPLATES.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelectTemplate(template)}
          className={`p-4 border-2 rounded-lg text-left transition-all ${
            selectedTemplateId === template.id
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{template.icon}</span>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {template.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {template.description}
              </p>
              {template.defaultTools.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {template.defaultTools.slice(0, 3).map((tool) => (
                    <span
                      key={tool}
                      className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded"
                    >
                      {tool}
                    </span>
                  ))}
                  {template.defaultTools.length > 3 && (
                    <span className="text-xs px-2 py-0.5 text-gray-500">
                      +{template.defaultTools.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}


