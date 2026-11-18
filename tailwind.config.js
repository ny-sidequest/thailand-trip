/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#eef2f8', 100: '#d5deec', 200: '#aebcd6', 300: '#7f93b7', 400: '#52688f', 500: '#304a73', 600: '#1e3558', 700: '#14284a', 800: '#0b1f3a', 900: '#071427' },
        sand: { 50: '#fbf8f2', 100: '#f6efe3', 200: '#ecdfc7', 300: '#dfc9a1', 400: '#cfae78', 500: '#bd9356' },
        jungle: { 50: '#ecf8f1', 100: '#d1f0de', 200: '#a2e0bd', 300: '#6fcfa0', 400: '#3fb583', 500: '#1f9d6b', 600: '#16805a', 700: '#126649', 800: '#0f4f3a' },
        night: { 950: '#050913', 900: '#070d1c', 800: '#0b1428', 700: '#101b36', 600: '#17264a' },
        ink: { 50: '#f3f6ff', 100: '#e3e9f8', 200: '#c4cde6', 300: '#98a6c8', 400: '#7886ad' },
        ember: { 50: '#fff4ec', 100: '#ffe4d1', 300: '#ffb283', 400: '#ff914d', 500: '#f97316', 600: '#dd5e0a', 700: '#b24607' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Outfit Variable"', 'Outfit', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,31,58,.05), 0 8px 24px -12px rgba(11,31,58,.18)',
        glass: 'inset 0 1px 0 rgba(255,255,255,.85), 0 1px 2px rgba(11,31,58,.04), 0 14px 34px -14px rgba(11,31,58,.28)',
        'glass-lg': 'inset 0 1px 0 rgba(255,255,255,.9), 0 24px 60px -20px rgba(11,31,58,.45)',
        glow: '0 0 0 1px rgba(63,181,131,.35), 0 6px 18px -4px rgba(31,157,107,.55)',
      },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.75rem' },
      keyframes: {
        rise: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        sheet: { '0%': { opacity: 0, transform: 'translateY(24px) scale(.98)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { rise: 'rise .45s cubic-bezier(.2,.7,.2,1) backwards', float: 'float 9s ease-in-out infinite', sheet: 'sheet .28s cubic-bezier(.2,.8,.2,1) backwards' },
    },
  },
  plugins: [],
}
