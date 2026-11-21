import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (
                id.includes('/react/') ||
                id.includes('/react-dom/') ||
                id.includes('/scheduler/') ||
                id.includes('/zustand/') ||
                id.includes('/@radix-ui/') ||
                id.includes('/lucide-react/') ||
                id.includes('/class-variance-authority/') ||
                id.includes('/clsx/') ||
                id.includes('/tailwind-merge/')
              ) {
                return 'vendor-ui'
              }
            }
            return undefined
          }
        }
      }
    }
  }
})
