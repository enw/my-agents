'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import MorphButton from './MorphButton';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const ONBOARDING_STORAGE_KEY = 'agent-builder-onboarding-completed';

export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
}

export function markOnboardingComplete(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
}

const steps = [
  {
    title: 'Welcome to Agent Builder!',
    description: 'Create AI agents that can use tools, search the web, and help you automate tasks.',
    content: (
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">What you can do:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>Create agents with custom system prompts</li>
            <li>Give agents tools like web search, file operations, and code execution</li>
            <li>Chat with agents and see their reasoning</li>
            <li>Export and share agents with others</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Create Your First Agent',
    description: 'Agents are AI assistants with specific roles and capabilities. Let\'s create one!',
    content: (
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Quick Start Options:</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span><strong>General Assistant:</strong> A helpful AI that can answer questions and use basic tools</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span><strong>Code Assistant:</strong> Specialized for programming help with code execution</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span><strong>Research Agent:</strong> Uses web search and Wikipedia for research tasks</span>
            </li>
          </ul>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          You can customize everything later - name, description, tools, and system prompt.
        </p>
      </div>
    ),
  },
  {
    title: 'Chat with Your Agent',
    description: 'Once created, you can chat with your agent and see it use tools in real-time.',
    content: (
      <div className="space-y-4">
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Try these in chat:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-green-800 dark:text-green-200">
            <li>Ask questions and get AI-powered responses</li>
            <li>Watch the agent use tools (web search, file operations, etc.)</li>
            <li>View execution traces to see how the agent thinks</li>
            <li>Continue previous conversations</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Power User Features',
    description: 'For advanced users, try these commands in chat:',
    content: (
      <div className="space-y-4">
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">Type "/" in chat to see commands:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-purple-800 dark:text-purple-200">
            <li><code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">/help</code> - Show all commands</li>
            <li><code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">/model</code> - Switch AI models</li>
            <li><code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">/trace</code> - Toggle execution trace</li>
            <li><code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">/clear</code> - Start new chat</li>
          </ul>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Commands are hidden by default but always available when you need them.
        </p>
      </div>
    ),
  },
];

export default function OnboardingModal({ isOpen, onClose, onComplete }: OnboardingModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [skipOnboarding, setSkipOnboarding] = useState(false);

  useEffect(() => {
    if (skipOnboarding) {
      markOnboardingComplete();
      onComplete();
    }
  }, [skipOnboarding, onComplete]);

  function handleNext() {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }

  function handlePrevious() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  function handleComplete() {
    markOnboardingComplete();
    onComplete();
  }

  function handleSkip() {
    setSkipOnboarding(true);
  }

  function handleCreateAgent() {
    markOnboardingComplete();
    router.push('/dashboard/new');
    onComplete();
  }

  if (!isOpen) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

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
            onClick={handleSkip}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {step.title}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Step {currentStep + 1} of {steps.length}
                </p>
              </div>
              <button
                onClick={handleSkip}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                aria-label="Skip onboarding"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <p className="text-gray-700 dark:text-gray-300 mb-6 text-lg">
                {step.description}
              </p>
              {step.content}
            </div>

            {/* Progress Indicator */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 flex-1 rounded-full transition-colors ${
                        index <= currentStep
                          ? 'bg-blue-600 dark:bg-blue-500'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  {!isFirstStep && (
                    <button
                      onClick={handlePrevious}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                    >
                      Previous
                    </button>
                  )}
                </div>

                <div className="flex gap-3">
                  {currentStep === 1 && (
                    <MorphButton
                      variant="primary"
                      onClick={handleCreateAgent}
                    >
                      Create Agent Now →
                    </MorphButton>
                  )}
                  {isLastStep ? (
                    <MorphButton
                      variant="primary"
                      onClick={handleComplete}
                    >
                      Get Started
                    </MorphButton>
                  ) : (
                    <MorphButton
                      variant="primary"
                      onClick={handleNext}
                    >
                      Next →
                    </MorphButton>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

