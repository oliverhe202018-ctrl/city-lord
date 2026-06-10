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
      minify: 'terser',
      terserOptions: {
        compress: {
          typeofs: false,
        },
      },
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
            if (id.includes('node_modules')) {
              if (id.includes('@turf/')) {
                return 'vendor-turf';
              }
              if (id.includes('@supabase/')) {
                return 'vendor-supabase';
              }
              // ✅ 修复：不再强制合并所有 React 依赖到一个块，交回 Rollup 自行推导顺序
              return undefined;
            }
          }
        }
      }
    }
  }
})
