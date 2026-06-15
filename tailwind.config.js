/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'monospace'],
      },
      colors: {
        indigo: {
          950: '#0f172a',
          900: '#1e1b4b',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        cream: '#fef3c7',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
