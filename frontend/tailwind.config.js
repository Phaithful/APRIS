/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#2E7D52',
          'green-dark': '#245F40',
          'green-light': '#E8F5EE',
        },
        page: '#F7F6F2',
        sidebar: '#1A2332',
        'sidebar-text': '#94A3B8',
        risk: {
          low: '#2E7D52',
          'low-bg': '#E8F5EE',
          medium: '#D97706',
          'medium-bg': '#FEF3C7',
          high: '#DC2626',
          'high-bg': '#FEE2E2',
        },
        navy: '#1A2332',
        'text-primary': '#1A2332',
        'text-secondary': '#6B7280',
        'card-border': '#E5E7EB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.10)',
      },
      keyframes: {
        pulse2: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.4)', opacity: '0.6' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        pulse2: 'pulse2 1.5s ease-in-out infinite',
        shimmer: 'shimmer 1.5s linear infinite',
      },
    },
  },
  plugins: [],
}

