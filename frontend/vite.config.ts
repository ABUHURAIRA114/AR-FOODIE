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

// mind-ar's prebuilt bundle imports the legacy `sRGBEncoding` constant,
// removed from three.js in r152+. This project uses a much newer three.js,
// so that bare import fails at build time. Redirect ONLY the exact bare
// "three" specifier to a shim that re-exports real three.js plus that one
// legacy constant — matched exactly (not by prefix) so subpath imports like
// "three/examples/jsm/loaders/GLTFLoader.js" and mind-ar's own
// "three/addons/..." imports are left completely untouched.
function threeCompatShim() {
  const shimPath = path.resolve(__dirname, 'src/lib/three-compat-shim.ts')
  return {
    name: 'three-compat-shim',
    enforce: 'pre' as const,
    resolveId(id: string, importer?: string) {
      // Let the shim's own `import ... from "three"` resolve normally to
      // the real package — only redirect everyone else's request for the
      // bare "three" specifier to the shim.
      if (id === 'three' && importer !== shimPath) {
        return shimPath
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    threeCompatShim(),
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

      '/menu-api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})