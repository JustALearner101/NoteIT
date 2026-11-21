/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          primary: 'var(--bg-canvas-primary)'
        },
        surface: {
          chrome: 'var(--bg-surface-chrome)',
          recessed: 'var(--bg-surface-recessed)',
          elevated: 'var(--bg-surface-elevated)',
          hover: 'var(--bg-surface-hover)',
          active: 'var(--bg-surface-active)'
        },
        border: {
          hairline: 'var(--border-hairline)',
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)'
        },
        ink: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)'
        },
        accent: {
          cobalt: 'var(--accent-cobalt)',
          amber: 'var(--accent-amber)',
          teal: 'var(--marker-teal)',
          emerald: 'var(--accent-emerald)',
          rose: 'var(--marker-red)',
          violet: 'var(--marker-violet)'
        },
        marker: {
          cobalt: 'var(--marker-cobalt)',
          amber: 'var(--marker-amber)',
          teal: 'var(--marker-teal)',
          red: 'var(--marker-red)',
          violet: 'var(--marker-violet)',
          slate: 'var(--marker-slate)'
        }
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', '"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        sans: ['"Inter"', '"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace']
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        popover: 'var(--shadow-popover)',
        'primary-cta': 'var(--shadow-primary-cta)',
        'node-selected': 'var(--shadow-node-selected)'
      }
    }
  },
  plugins: []
}
