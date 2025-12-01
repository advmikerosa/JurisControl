import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
    },
    
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      cssCodeSplit: true,
      
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') && !id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('react-dom')) {
                return 'vendor-react-dom';
              }
              if (id.includes('react-router')) {
                return 'vendor-router';
              }
              if (id.includes('recharts')) return 'vendor-charts';
              if (id.includes('framer-motion')) return 'vendor-animation';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('supabase')) return 'vendor-supabase';
              if (id.includes('date-fns')) return 'vendor-dates';
              return 'vendor-others';
            }
            
            if (id.includes('src/context')) {
              return 'context-providers';
            }
            if (id.includes('src/components')) {
              return 'ui-components';
            }
            if (id.includes('src/views')) {
              return 'views-lazy';
            }
            if (id.includes('src/services')) {
              return 'services';
            }
          },
          
          entryFileNames: 'js/[name]-[hash].js',
          chunkFileNames: 'js/chunk-[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
      
      chunkSizeWarningLimit: 1000,
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
    },
    
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@supabase/supabase-js',
        'framer-motion',
        'lucide-react',
        'recharts',
      ],
    },
    
    server: {
      host: '0.0.0.0',
      port: 8080,
      watch: {
        usePolling: false,
      },
    },
  };
});
