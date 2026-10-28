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
          elevated: 'var(--bg-surface-elevated)',
          hover: 'var(--bg-surface-hover)'
        },
        border: {
          hairline: 'var(--border-hairline)',
          subtle: 'var(--border-subtle)'
        },
        ink: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)'
        },
        accent: {
          cobalt: 'var(--accent-cobalt)',
          amber: 'var(--accent-amber)'
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
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}
