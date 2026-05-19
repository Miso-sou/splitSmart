/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'rgba(255, 255, 255, 0.06)',
        'surface-hover': 'rgba(255, 255, 255, 0.10)',
        'surface-border': 'rgba(255, 255, 255, 0.12)',
        accent: '#6ee7b7',
        'accent-dim': '#34d399',
        muted: 'rgba(255,255,255,0.45)',
        danger: '#f87171',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        display: ['"Syne"', 'sans-serif'],
      },
      backdropBlur: {
        xs: '4px',
      },
      boxShadow: {
        glass: '0 4px 24px rgba(0, 0, 0, 0.25)',
        'glass-lg': '0 8px 40px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
}
