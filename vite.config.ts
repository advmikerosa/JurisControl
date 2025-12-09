
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente baseadas no modo (development/production)
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY || '')
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react')) return 'vendor-react';
              if (id.includes('recharts')) return 'vendor-charts';
              if (id.includes('framer-motion')) return 'vendor-animation';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('@supabase')) return 'vendor-supabase';
              return 'vendor-others';
            }
          }
        }
      }
    },
    server: {
      host: '0.0.0.0',
      port: 8080,
    }
  };
});
