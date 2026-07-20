import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  build: {
    // Silence the warning — we handle it via manualChunks below
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        manualChunks: {
          // React core — changes almost never, best for long-term caching
          'vendor-react': ['react', 'react-dom'],

          // Framer Motion — large animation library, isolated chunk
          'vendor-motion': ['framer-motion'],

          // PDF viewer — heaviest dependency (~300kB), lazy-loaded separately
          'vendor-pdf': ['react-pdf'],

          // Markdown renderer
          'vendor-markdown': ['react-markdown'],

          // Clerk auth
          'vendor-clerk': ['@clerk/clerk-react'],

          // Remaining small vendor libs bundled together
          'vendor-misc': ['axios', 'react-dropzone', 'react-hot-toast', 'lucide-react'],
        },
      },
    },
  },
})
