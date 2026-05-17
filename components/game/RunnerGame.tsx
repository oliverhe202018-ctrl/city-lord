'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Play, RefreshCw, Trophy } from 'lucide-react'
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

function RunnerLite() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [distance, setDistance] = useState(0)
  const [coins, setCoins] = useState(0)
  const [speed, setSpeed] = useState(0)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isPlaying) {
      setSpeed(10)
      interval = setInterval(() => {
        setDistance(prev => prev + 1)
        if (Math.random() > 0.9) setCoins(prev => prev + 1)
      }, 100)
    } else {
      setSpeed(0)
    }
    return () => clearInterval(interval)
  }, [isPlaying])

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white p-6 rounded-lg border border-cyan-500/30">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-cyan-400 mb-2">Runner Mode (Lite)</h2>
        <p className="text-white/60 text-sm">Game Engine failed to load. Running in simulation mode.</p>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8 w-full max-w-md">
        <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
          <div className="text-sm text-white/40 uppercase tracking-wider mb-1">Distance</div>
          <div className="text-3xl font-mono font-bold text-white">{distance}m</div>
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
          <div className="text-sm text-white/40 uppercase tracking-wider mb-1">Coins</div>
          <div className="text-3xl font-mono font-bold text-yellow-400">{coins}</div>
        </div>
      </div>

      <div className="relative w-full max-w-md h-32 bg-gray-900 rounded-xl overflow-hidden mb-8 border border-white/5">
        {/* Simple scrolling animation */}
        <div className={`absolute inset-0 flex items-center justify-center ${isPlaying ? 'animate-pulse' : ''}`}>
           <div className="w-full h-1 bg-cyan-500/50 absolute top-1/2" />
           {isPlaying && (
             <div className="absolute w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_10px_cyan] animate-bounce" style={{ left: '20%' }} />
           )}
        </div>
        {!isPlaying && distance === 0 && (
           <div className="absolute inset-0 flex items-center justify-center text-white/20 text-sm">
             Press Start to Run
           </div>
        )}
      </div>

      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className={`px-8 py-3 rounded-full font-bold text-lg flex items-center gap-2 transition-all ${
          isPlaying 
            ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
            : 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
        }`}
      >
        {isPlaying ? <span className="flex items-center gap-2">Stop Run</span> : <span className="flex items-center gap-2"><Play size={20} fill="currentColor" /> Start Run</span>}
      </button>
    </div>
  )
}

export function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [useLiteMode, setUseLiteMode] = useState(false)

  useEffect(() => {
    // Check if cc is already defined (e.g. from previous mount)
    if ((window as any).cc) {
      initGame()
      setIsLoading(false)
      return
    }

    const loadScript = (url: string) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = url
            script.async = true
            script.onload = resolve
            script.onerror = reject
            document.body.appendChild(script)
        })
    }

    const tryLoadEngine = async () => {
        const urls = [
            'https://cdn.jsdelivr.net/gh/cocos2d/cocos2d-html5@v3.13/cocos2d-html5.min.js',
            'https://raw.githubusercontent.com/cocos2d/cocos2d-html5/v3.13/cocos2d-html5.min.js'
        ]

        for (const url of urls) {
            try {
                await loadScript(url)
                setIsLoading(false)
                initGame()
                return
            } catch (e) {
                console.warn(`Failed to load Cocos2d from ${url}`)
            }
        }

        // All failed
        setIsLoading(false)
        setError("Failed to load game engine.")
        setUseLiteMode(true)
    }

    tryLoadEngine()

    return () => {
      // Cleanup if needed
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

  if (useLiteMode) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-black">
        <RunnerLite />
      </div>
    )
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
      
      {error && !useLiteMode && (
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
