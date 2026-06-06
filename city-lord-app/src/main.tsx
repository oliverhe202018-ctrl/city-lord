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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

