/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI"', 'Inter', 'sans-serif'],
      },
      colors: {
        kwl: {
          navy: {
            950: '#030b16',
            900: '#07111f',
            800: '#0c1a2b',
          },
          panel: {
            bg: 'rgba(15, 23, 42, 0.70)',
            bgStrong: 'rgba(15, 23, 42, 0.80)',
            border: 'rgba(148, 163, 184, 0.20)',
            borderStrong: 'rgba(148, 163, 184, 0.35)',
          },
          brand: {
            sky: '#38bdf8',
            skyHover: '#7dd3fc',
            blue: '#2563eb',
            cyan: '#22d3ee',
            cyanHover: '#0e7490',
          },
          status: {
            completed: '#22c55e',
            failed: '#ef4444',
            paused: '#fbbf24',
            active: '#22d3ee',
            default: '#94a3b8',
          },
          text: {
            primary: '#f8fafc',
            secondary: '#e2e8f0',
            muted: '#94a3b8',
            label: '#7dd3fc',
            helper: '#64748b',
          },
        },
      },
      borderRadius: {
        'kwl-sm': '8px',
        'kwl': '12px',
        'kwl-lg': '20px',
        'kwl-xl': '24px',
      },
      spacing: {
        'kwl-xs': '8px',
        'kwl-sm': '12px',
        'kwl-md': '16px',
        'kwl-lg': '22px',
        'kwl-xl': '32px',
      },
      boxShadow: {
        'kwl-panel': '0 12px 32px rgba(2, 6, 23, 0.44)',
        'kwl-card': '0 10px 24px rgba(2, 6, 23, 0.16)',
        'kwl-glow': '0 0 16px rgba(56, 189, 248, 0.18)',
        'kwl-focus': '0 0 0 3px rgba(56, 189, 248, 0.18)',
      },
      maxWidth: {
        'kwl-content': '1180px',
      },
      minWidth: {
        'kwl-sidebar': '240px',
      },
    },
  },
  plugins: [],
};