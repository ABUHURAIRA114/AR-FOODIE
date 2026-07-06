import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
    assetsInclude: ['**/*.svg', '**/*.csv', '**/*.glb', '**/*.usdz'],

  // Proxy API and media requests to Django during development
  server: {
    proxy: {
      '/api': {
        target: 'https://dinenics-api.up.railway.app',
        changeOrigin: true,
      },
      '/media': {
        target: 'https://dinenics-api.up.railway.app',
        changeOrigin: true,
      },
      '/view': {
        target: 'https://dinenics-api.up.railway.app',
        changeOrigin: true,
      },
    },
  },
})
