import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { injectStoreDependencies } from './lib/fetch-shim'
import { useStore } from './store/useStore'

// 启动时注入 store 依赖，解除 fetch-shim 与 store 的循环引用
injectStoreDependencies(
  () => useStore.getState().token,
  (token: string) => useStore.setState({ token })
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      },
      (err) => {
        console.log('ServiceWorker registration failed: ', err);
      }
    );
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

