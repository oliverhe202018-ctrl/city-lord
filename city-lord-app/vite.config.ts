import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, path.resolve(__dirname, '..'), ''),
    ...loadEnv(mode, process.cwd(), '')
  }
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      'process.env.NEXT_PUBLIC_AMAP_KEY': JSON.stringify(env.NEXT_PUBLIC_AMAP_KEY),
      'process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE': JSON.stringify(env.NEXT_PUBLIC_AMAP_SECURITY_CODE),
      'process.env.NEXT_PUBLIC_API_SERVER': JSON.stringify(env.NEXT_PUBLIC_API_SERVER || 'https://cl1.6543666.xyz')
    },
    build: {
      minify: 'esbuild',
      sourcemap: true,
      rollupOptions: {
        external: [
          '@capacitor/sensors',
          '@capacitor/sound',
          '@capawesome/capacitor-background-task',
          'capacitor-native-settings'
        ],
        output: {
          manualChunks(id) {
            const normalId = id.replace(/\\/g, '/');
            
            // Skip node_modules first
            if (normalId.includes('node_modules')) {
              if (normalId.includes('@turf/')) {
                return 'vendor-turf';
              }
              if (normalId.includes('@supabase/')) {
                return 'vendor-supabase';
              }
              return undefined;
            }

            // Group all local context and provider files to prevent TDZ crashes
            const isContextOrProvider =
              normalId.includes('/contexts/') ||
              normalId.includes('/providers/') ||
              /context/i.test(normalId) ||
              /provider/i.test(normalId);

            const isExcluded =
              normalId.includes('AMapViewWithProvider') ||
              normalId.includes('Providers.tsx') ||
              normalId.includes('/components/ui/') ||
              normalId.includes('context-menu.tsx');

            if (isContextOrProvider && !isExcluded) {
              return 'app-contexts';
            }
          }
        }
      }
    }
  }
})
