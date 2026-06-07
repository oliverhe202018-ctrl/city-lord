import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { injectStoreDependencies } from './lib/fetch-shim'
import { useStore } from './store/useStore'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

// 启动时注入 store 依赖，解除 fetch-shim 与 store 的循环引用
injectStoreDependencies(
  () => useStore.getState().token,
  (token: string) => useStore.setState({ token })
)

// 提早在 React Hydration 树之外发起首次高精度预热，唤醒 GPS 模块
if (Capacitor.isNativePlatform()) {
  Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

