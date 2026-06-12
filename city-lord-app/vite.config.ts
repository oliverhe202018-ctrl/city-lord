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
              if (normalId.includes('@amap/amap-jsapi-loader')) {
                return 'vendor-amap';
              }
              if (normalId.includes('react') || normalId.includes('react-dom') || normalId.includes('react-router-dom')) {
                return 'vendor-react';
              }
              if (normalId.includes('@supabase/')) {
                return 'vendor-supabase';
              }
              if (normalId.includes('zustand')) {
                return 'vendor-zustand';
              }
              if (normalId.includes('lucide-react') || normalId.includes('sonner')) {
                return 'vendor-ui';
              }
              if (normalId.includes('@turf/')) {
                return 'vendor-turf';
              }
            }
          }
        }
      },
      cssCodeSplit: true,
      minify: 'esbuild',
    }
  }
})
