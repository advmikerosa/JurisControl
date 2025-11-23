import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    // Otimização para chunks menores e carregamento mais rápido
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'framer-motion'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          ui: ['lucide-react', 'recharts']
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
  }
})