/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        basalt: {
          950: '#0b0a09',
          900: '#12100e',
          850: '#181512',
          800: '#1f1b17',
          700: '#2a241f',
          600: '#3a322b',
          500: '#54483e',
        },
        ember: {
          50: '#fdf5ef',
          100: '#fae6d7',
          200: '#f3c9ab',
          300: '#eaa67a',
          400: '#df7f4a',
          500: '#d2602c',
          600: '#b94a1e',
          700: '#98391a',
          800: '#7b301c',
          900: '#642a1a',
        },
        sand: {
          100: '#f5efe6',
          200: '#e9decf',
          300: '#d9c8b2',
        },
      },
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.25), 0 12px 32px -18px rgba(0,0,0,.55)',
        glow: '0 0 0 1px rgba(210,96,44,.25), 0 12px 40px -12px rgba(210,96,44,.35)',
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
