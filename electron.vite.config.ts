import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

const root = import.meta.dirname

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(root, 'src/main/index.ts'),
          'whisper-worker': resolve(root, 'src/main/transcription/whisper-worker.ts')
        }
      }
    },
    resolve: {
      alias: { '@shared': resolve(root, 'src/shared') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(root, 'src/preload/index.ts') }
      }
    },
    resolve: {
      alias: { '@shared': resolve(root, 'src/shared') }
    }
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(root, 'src/renderer/index.html'),
          bar: resolve(root, 'src/renderer/bar.html')
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(root, 'src/shared'),
        '@': resolve(root, 'src/renderer/src')
      }
    }
  }
})
