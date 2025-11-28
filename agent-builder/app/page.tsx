'use client';

import { useRouter } from 'next/navigation';
import ThemeToggle from './components/ThemeToggle';
import MorphButton from './components/MorphButton';
import AnimatedCard from './components/AnimatedCard';
import { motion } from 'framer-motion';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>
      <div className="text-center max-w-3xl px-6 py-16">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-5xl font-semibold mb-6 text-gray-900 dark:text-white"
        >
          Local Agent Builder
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-gray-600 dark:text-gray-400 mb-10 text-lg leading-relaxed"
        >
          Build and run AI agents locally with tool-use capabilities. 
          Supports local models (Ollama) and remote models (OpenRouter, OpenAI, Anthropic).
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex gap-4 justify-center mb-16"
        >
          <MorphButton variant="primary" onClick={() => router.push('/dashboard')}>
            Get Started
          </MorphButton>
          <MorphButton variant="secondary" onClick={() => router.push('/docs')}>
            View Docs
          </MorphButton>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <AnimatedCard delay={0.15}>
            <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">🤖 Agent Management</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Create, edit, and manage multiple agent configurations with custom system prompts and tool allowlists.
            </p>
          </AnimatedCard>
          <AnimatedCard delay={0.2}>
            <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">🔧 Tool System</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Built-in tools for shell commands, HTTP requests, file operations, and code execution with security sandboxing.
            </p>
          </AnimatedCard>
          <AnimatedCard delay={0.25}>
            <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">📊 Execution Tracing</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Detailed logs of agent runs, tool calls, token usage, and performance metrics.
            </p>
          </AnimatedCard>
        </div>
      </div>
    </div>
  );
}