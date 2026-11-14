/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        inset: 'rgb(var(--inset) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        'fg-secondary': 'rgb(var(--fg-secondary) / <alpha-value>)',
        'fg-muted': 'rgb(var(--fg-muted) / <alpha-value>)',
        brand: 'rgb(var(--brand) / <alpha-value>)',
        'brand-hover': 'rgb(var(--brand-hover) / <alpha-value>)',
        'brand-fg': 'rgb(var(--brand-fg) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        'success-fg': 'rgb(var(--success-fg) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        'warn-fg': 'rgb(var(--warn-fg) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        'danger-fg': 'rgb(var(--danger-fg) / <alpha-value>)',
        'warmup-bg': 'rgb(var(--warmup-bg) / <alpha-value>)',
        'warmup-fg': 'rgb(var(--warmup-fg) / <alpha-value>)',
        'drop-bg': 'rgb(var(--drop-bg) / <alpha-value>)',
        'drop-fg': 'rgb(var(--drop-fg) / <alpha-value>)',
        'failure-bg': 'rgb(var(--failure-bg) / <alpha-value>)',
        'failure-fg': 'rgb(var(--failure-fg) / <alpha-value>)',
        'pr-bg': 'rgb(var(--pr-bg) / <alpha-value>)',
        'pr-fg': 'rgb(var(--pr-fg) / <alpha-value>)',
        'art-well': 'rgb(var(--art-well) / <alpha-value>)',
        'art-ink': 'rgb(var(--art-ink) / <alpha-value>)',
        heat: {
          0: 'rgb(var(--heat-0) / <alpha-value>)',
          1: 'rgb(var(--heat-1) / <alpha-value>)',
          2: 'rgb(var(--heat-2) / <alpha-value>)',
          3: 'rgb(var(--heat-3) / <alpha-value>)',
          4: 'rgb(var(--heat-4) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Anuphan', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Inter', 'Anuphan', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: 'var(--shadow)',
        glow: '0 0 0 1px rgb(var(--brand) / .25), 0 12px 40px -12px rgb(var(--brand) / .35)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '.55' },
          '50%': { opacity: '1' },
        },
        pop: {
          '0%': { transform: 'scale(.85)' },
          '70%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp .35s ease-out both',
        pulseSoft: 'pulseSoft 2s ease-in-out infinite',
        pop: 'pop .35s ease-out both',
      },
    },
  },
  plugins: [],
};
