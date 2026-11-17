/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#eef2f8', 100: '#d5deec', 200: '#aebcd6', 300: '#7f93b7', 400: '#52688f', 500: '#304a73', 600: '#1e3558', 700: '#14284a', 800: '#0b1f3a', 900: '#071427' },
        sand: { 50: '#fbf8f2', 100: '#f6efe3', 200: '#ecdfc7', 300: '#dfc9a1', 400: '#cfae78', 500: '#bd9356' },
        jungle: { 50: '#ecf8f1', 100: '#d1f0de', 200: '#a2e0bd', 400: '#3fb583', 500: '#1f9d6b', 600: '#16805a', 700: '#126649', 800: '#0f4f3a' },
        ember: { 50: '#fff4ec', 100: '#ffe4d1', 300: '#ffb283', 400: '#ff914d', 500: '#f97316', 600: '#dd5e0a' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(11,31,58,.05), 0 8px 24px -12px rgba(11,31,58,.18)' },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.75rem' },
      keyframes: { rise: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } } },
      animation: { rise: 'rise .35s ease-out both' },
    },
  },
  plugins: [],
}
