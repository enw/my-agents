'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { getAllCommands, getCommandsByCategory, CommandDefinition } from '../dashboard/chat/[id]/commands';

interface CommandHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandHelpModal({ isOpen, onClose }: CommandHelpModalProps) {
  if (!isOpen) return null;

  const localCommands = getCommandsByCategory('local');
  const configCommands = getCommandsByCategory('config');
  const semanticCommands = getCommandsByCategory('semantic');

  function renderCommand(command: CommandDefinition) {
    return (
      <div key={command.name} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition">
        <div className="flex items-start justify-between mb-2">
          <div>
            <code className="text-sm font-mono text-blue-600 dark:text-blue-400">
              /{command.name}
            </code>
            {command.aliases && command.aliases.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                (aliases: {command.aliases.map(a => `/${a}`).join(', ')})
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          {command.description}
        </p>
        {command.usage && (
          <p className="text-xs text-gray-600 dark:text-gray-400 font-mono mb-1">
            Usage: {command.usage}
          </p>
        )}
        {command.examples && command.examples.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Examples:</p>
            <div className="space-y-1">
              {command.examples.map((example, idx) => (
                <code key={idx} className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded block">
                  {example}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Command Reference
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Type "/" in chat to see available commands
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* Local Commands */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Navigation & UI Commands
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  These commands control the interface and don't affect conversations.
                </p>
                <div className="space-y-2">
                  {localCommands.map(renderCommand)}
                </div>
              </div>

              {/* Config Commands */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Configuration Commands
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  These commands change settings for the next request.
                </p>
                <div className="space-y-2">
                  {configCommands.map(renderCommand)}
                </div>
              </div>

              {/* Semantic Commands */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Semantic Commands
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  These commands are converted to messages and saved to the conversation.
                </p>
                <div className="space-y-2">
                  {semanticCommands.map(renderCommand)}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Got it!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

