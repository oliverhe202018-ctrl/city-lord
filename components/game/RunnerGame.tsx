'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
// @ts-ignore
import createEntitySpawner from '@/lib/cocos/EntitySpawner'
// @ts-ignore
import createParallaxManager from '@/lib/cocos/ParallaxManager'
// @ts-ignore
import createRunnerScene from '@/lib/cocos/RunnerScene'
// @ts-ignore
import createWeatherSystem from '@/lib/cocos/WeatherSystem'
// @ts-ignore
import createLightingEffects from '@/lib/cocos/LightingEffects'
// @ts-ignore
import createAssetLoader from '@/lib/cocos/AssetLoader'
// @ts-ignore
import createSvgTextureGenerator from '@/lib/cocos/SvgTextureGenerator'
// @ts-ignore
import MapConfig from '@/lib/cocos/MapConfig'

export function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if cc is already defined (e.g. from previous mount)
    if ((window as any).cc) {
      initGame()
      setIsLoading(false)
      return
    }

    const script = document.createElement('script')
    // Using a more reliable CDN for Cocos2d-html5 (v3.13) or a local fallback if available
    // Trying jsdelivr as it is often more stable globally
    script.src = 'https://cdn.jsdelivr.net/gh/cocos2d/cocos2d-html5@v3.13/cocos2d-html5.min.js'
    script.async = true
    
    script.onload = () => {
      setIsLoading(false)
      initGame()
    }

    script.onerror = () => {
      setIsLoading(false)
      setError("Failed to load game engine. Please check network connection.")
    }

    document.body.appendChild(script)

    return () => {
      // Cleanup if needed (Cocos singleton might persist, which is tricky in React)
      // Usually we don't remove the script to avoid reloading it unnecessarily
    }
  }, [])

  const initGame = () => {
    const cc = (window as any).cc
    if (!cc) return

    // Inject 'cc' into our factory functions
    const EntitySpawner = createEntitySpawner(cc)
    const ParallaxManager = createParallaxManager(cc)
    const WeatherSystem = createWeatherSystem(cc)
    const LightingEffects = createLightingEffects(cc)
    const SvgTextureGenerator = createSvgTextureGenerator(cc)
    const AssetLoader = createAssetLoader(cc, SvgTextureGenerator)
    
    const assetLoader = new AssetLoader();

    // Initialize LightingEffects with assetLoader
    LightingEffects.init(assetLoader);
    
    // Pass assetLoader and MapConfig to RunnerScene
    const RunnerScene = createRunnerScene(cc, ParallaxManager, EntitySpawner, WeatherSystem, LightingEffects, assetLoader, MapConfig)

    // Configuration
    const config = {
      debugMode: 1,
      showFPS: true,
      frameRate: 60,
      id: "gameCanvas",
      renderMode: 1, // Canvas mode usually better for compatibility
      jsList: []
    }

    // cc.game.run expects to find the canvas by ID
    if (cc.game) {
       cc.game.run(config, function () {
           // Resources to preload from MapConfig
           const resources = Object.values(MapConfig.resources);
           
           // Use our AssetLoader to preload and handle placeholders
           assetLoader.load(resources, MapConfig, function() {
                cc.director.runScene(new RunnerScene());
           });
       });
    }
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
            <p className="text-cyan-400 text-sm">Loading Engine...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
          <div className="text-red-500 text-center">
            <p>{error}</p>
          </div>
        </div>
      )}

      <canvas 
        id="gameCanvas" 
        ref={canvasRef} 
        width={800} 
        height={450} 
        className="max-w-full max-h-full border border-white/10 rounded-lg shadow-2xl"
      />
    </div>
  )
}
