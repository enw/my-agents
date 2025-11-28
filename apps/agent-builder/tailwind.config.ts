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
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Design system colors
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
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          light: '#DBEAFE',
        },
      },
      spacing: {
        // Generous whitespace scale
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
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
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.5' }],
        lg: ['1.125rem', { lineHeight: '1.5' }],
        xl: ['1.5rem', { lineHeight: '1.2' }],
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
