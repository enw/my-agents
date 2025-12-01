import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Bloomberg Lite palette
        'bg-base': 'var(--bg-base)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-subtle': 'var(--bg-subtle)',
        'bg-hover': 'var(--bg-hover)',
        'bg-selected': 'var(--bg-selected)',
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-inverse': 'var(--text-inverse)',
        'accent-blue': 'var(--accent-blue)',
        'accent-green': 'var(--accent-green)',
        'accent-amber': 'var(--accent-amber)',
        'accent-red': 'var(--accent-red)',
        'accent-purple': 'var(--accent-purple)',
        // Legacy support
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        neutral: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        accent: {
          DEFAULT: 'var(--accent-blue)',
          hover: '#2563EB',
          light: '#1E3A8A',
        },
      },
      spacing: {
        // Compact spacing scale
        '1': 'var(--space-1)',
        '1.5': 'var(--space-1_5)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        // Legacy
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        'xs': 'var(--radius-xs)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
      },
      boxShadow: {
        'soft': 'var(--shadow-soft)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          '"Fira Sans"',
          '"Droid Sans"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      },
      fontSize: {
        // Compact typography scale
        xs: ['11px', { lineHeight: '1.3' }],
        sm: ['12px', { lineHeight: '1.3' }],
        md: ['13px', { lineHeight: '1.3' }],
        lg: ['14px', { lineHeight: '1.3' }],
        xl: ['16px', { lineHeight: '1.3' }],
        // Legacy sizes
        base: ['13px', { lineHeight: '1.3' }],
        '2xl': ['2rem', { lineHeight: '1.2' }],
        '3xl': ['2.5rem', { lineHeight: '1.2' }],
      },
      transitionDuration: {
        '150': '150ms',
        '180': '180ms',
      },
      transitionTimingFunction: {
        'ease-out-kinetic': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'ease-out-sharp': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'ease-out-gentle': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
      animation: {
        'glide-fade-in': 'glide-fade-in 180ms ease-out-gentle',
        'morph-in': 'morph-in 180ms ease-out-kinetic',
        'fade-out': 'fade-out 150ms ease-out-sharp',
        'fade-in': 'fade-in 150ms ease-out-sharp',
      },
      keyframes: {
        'glide-fade-in': {
          '0%': {
            opacity: '0',
            transform: 'translateY(8px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'morph-in': {
          '0%': {
            opacity: '0',
            transform: 'scale(0.95)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        'fade-out': {
          '0%': {
            opacity: '1',
          },
          '100%': {
            opacity: '0',
          },
        },
        'fade-in': {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },
      },
    },
  },
  plugins: [],
};
export default config;
