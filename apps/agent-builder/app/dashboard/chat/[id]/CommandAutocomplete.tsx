'use client';

import { useEffect, useRef, useState } from 'react';
import { CommandDefinition, CommandContext, CommandCategory } from './commands';
import { parseCommand, getCommandSuggestions } from './commandParser';

interface CommandAutocompleteProps {
  input: string;
  cursorPosition: number;
  commands: CommandDefinition[];
  selectedIndex: number;
  onSelect: (command: CommandDefinition, suggestion?: string) => void;
  onClose: () => void;
  context: CommandContext;
  inputRef: React.RefObject<HTMLInputElement>;
}

const categoryLabels: Record<CommandCategory, string> = {
  local: 'Navigation',
  config: 'Configuration',
  semantic: 'Memory',
};

const categoryColors: Record<CommandCategory, string> = {
  local: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  config: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  semantic: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export default function CommandAutocomplete({
  input,
  cursorPosition,
  commands,
  selectedIndex,
  onSelect,
  onClose,
  context,
  inputRef,
}: CommandAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionCommand, setSuggestionCommand] = useState<CommandDefinition | null>(null);

  // Check if we should show suggestions for a specific command
  useEffect(() => {
    const parsed = parseCommand(input, cursorPosition);
    // Show suggestions if we have a command that supports them and we're at the right position
    if (parsed.isCommand && parsed.command) {
      const command = commands.find(
        (cmd) => cmd.name === parsed.command || cmd.aliases?.includes(parsed.command)
      );
      
      // Show suggestions if command supports them and we're typing the command or first arg
      if (command && command.getSuggestions) {
        setSuggestionCommand(command);
        getCommandSuggestions(command, parsed.args, context).then((sugs) => {
          setSuggestions(sugs);
          // Show suggestions if we have them and we're not in the middle of typing a full command
          setShowSuggestions(sugs.length > 0 && (parsed.args.length === 0 || input.endsWith(' ')));
        });
      } else {
        setShowSuggestions(false);
        setSuggestionCommand(null);
      }
    } else {
      setShowSuggestions(false);
      setSuggestionCommand(null);
    }
  }, [input, cursorPosition, commands, context]);

  // Group commands by category
  const groupedCommands = commands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<CommandCategory, CommandDefinition[]>);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      const container = containerRef.current;
      const selected = selectedRef.current;
      const containerRect = container.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      
      if (selectedRect.top < containerRect.top) {
        container.scrollTop -= containerRect.top - selectedRect.top;
      } else if (selectedRect.bottom > containerRect.bottom) {
        container.scrollTop += selectedRect.bottom - containerRect.bottom;
      }
    }
  }, [selectedIndex]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, inputRef]);

  // Show suggestions if available, otherwise show commands
  if (showSuggestions && suggestionCommand && suggestions.length > 0) {
    return (
      <div
        ref={containerRef}
        className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-[300px] overflow-y-auto z-50"
      >
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          Suggestions for /{suggestionCommand.name}
        </div>
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion}
            onClick={() => {
              const parsed = parseCommand(input, cursorPosition);
              // Call onSelect with the suggestion
              onSelect(suggestionCommand, suggestion);
            }}
            className="px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-900 dark:text-white">
                {suggestion}
              </span>
              {suggestionCommand?.name === 'model' && context.models.find((m: any) => m.id === suggestion) && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({context.models.find((m: any) => m.id === suggestion)?.displayName || suggestion})
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (commands.length === 0) {
    return null;
  }

  let currentIndex = 0;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-[300px] overflow-y-auto z-50"
      style={{
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {Object.entries(groupedCommands).map(([category, categoryCommands]) => (
        <div key={category}>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
            {categoryLabels[category as CommandCategory]}
          </div>
          {categoryCommands.map((command) => {
            const index = currentIndex++;
            const isSelected = index === selectedIndex;
            const displayName = command.aliases?.length
              ? `${command.name} (${command.aliases.join(', ')})`
              : command.name;

            return (
              <div
                key={command.name}
                ref={isSelected ? selectedRef : null}
                onClick={() => onSelect(command)}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                        /{command.name}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${categoryColors[command.category]}`}
                      >
                        {categoryLabels[command.category]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                      {command.description}
                    </p>
                    {command.usage && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {command.usage}
                      </p>
                    )}
                    {command.examples && command.examples.length > 0 && (
                      <div className="mt-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Examples:{' '}
                          <span className="font-mono">
                            {command.examples.join(', ')}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {commands.length === 0 && (
        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
          No commands found
        </div>
      )}
    </div>
  );
}

