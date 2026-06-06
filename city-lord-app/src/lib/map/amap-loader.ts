let amapPromise: Promise<typeof window.AMap> | null = null

export function loadAMap(): Promise<typeof window.AMap> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('AMap can only load in browser'))
  }

  if ((window as any).AMap) {
    return Promise.resolve((window as any).AMap)
  }

  if (!amapPromise) {
    amapPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src =
        'https://webapi.amap.com/maps?v=2.0&key=e7c09f023c10603e1fa8877e796965e9&plugin=AMap.Scale,AMap.ToolBar'
      script.async = true

      script.onload = () => {
        if ((window as any).AMap) {
          resolve((window as any).AMap)
        } else {
          reject(new Error('AMap loaded but not found on window'))
        }
      }

      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  return amapPromise
}