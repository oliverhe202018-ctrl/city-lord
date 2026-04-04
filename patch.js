const fs = require('fs');
let content = fs.readFileSync('components/citylord/start/StartRunPageClient.tsx', 'utf8');

const target1 = `  useEffect(() => {
    let mounted = true
    const checkBatteryOptimization = async () => {
      const native = await isNativePlatform()
      if (!native || !mounted) return

      const { Capacitor, registerPlugin } = await import("@capacitor/core")
      if (Capacitor.getPlatform() !== "android") return

      let restricted = true
      try {
        const AMapLocation = registerPlugin<BatteryOptimizationPlugin>("AMapLocation")
        if (typeof AMapLocation.isIgnoringBatteryOptimizations === "function") {
          const result = await AMapLocation.isIgnoringBatteryOptimizations()
          const ignoring = typeof result === "boolean"
            ? result
            : Boolean(result.ignoring ?? result.isIgnoring ?? result.value)
          restricted = !ignoring
        }
      } catch {
        restricted = true
      }

      if (restricted && mounted) setShowBatteryModal(true)
    }
    checkBatteryOptimization()
    return () => {
      mounted = false
    }
  }, [])`;

const repl1 = `  const checkBatteryOptimization = useCallback(async () => {
    if (typeof window !== 'undefined' && window.localStorage.getItem('city-lord-skip-battery-warning') === 'true') return;
    const native = await isNativePlatform()
    if (!native) return

    const { Capacitor, registerPlugin } = await import("@capacitor/core")
    if (Capacitor.getPlatform() !== "android") return

    let restricted = true
    try {
      const AMapLocation = registerPlugin<BatteryOptimizationPlugin>("AMapLocation")
      if (typeof AMapLocation.isIgnoringBatteryOptimizations === "function") {
        const result = await AMapLocation.isIgnoringBatteryOptimizations()
        const ignoring = typeof result === "boolean"
          ? result
          : Boolean(result.ignoring ?? result.isIgnoring ?? result.value)
        restricted = !ignoring
      }
    } catch {
      restricted = true
    }

    if (restricted) setShowBatteryModal(true)
    else setShowBatteryModal(false)
  }, [])

  useEffect(() => {
    let mounted = true
    checkBatteryOptimization()

    let listenerPromise = null;
    const setupListener = async () => {
      const native = await isNativePlatform()
      if (!native) return
      const { Capacitor } = await import("@capacitor/core")
      if (Capacitor.getPlatform() === 'android') {
        try {
          const { App } = await import('@capacitor/app')
          listenerPromise = App.addListener('appStateChange', ({ isActive }) => {
            if (isActive && mounted) {
              checkBatteryOptimization()
            }
          })
        } catch {}
      }
    }
    setupListener()

    return () => {
      mounted = false
      if (listenerPromise) {
        listenerPromise.then(handle => handle.remove()).catch(() => {})
      }
    }
  }, [checkBatteryOptimization])`;

const target2 = `                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-xl border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
                  onClick={() => setShowGuideModal(true)}
                >
                  阅读指南 (Read article)
                </Button>`;

const repl2 = `                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-xl border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
                  onClick={() => setShowGuideModal(true)}
                >
                  阅读指南 (Read article)
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 w-full rounded-xl text-rose-900 hover:bg-rose-50/50 dark:text-rose-100 dark:hover:bg-slate-800"
                  onClick={() => {
                    localStorage.setItem("city-lord-skip-battery-warning", "true")
                    setShowBatteryModal(false)
                    toast.success("已设置不再提醒")
                  }}
                >
                  不再提醒 (Don't show again)
                </Button>`;

function normalize(str) {
    return str.replace(/\\r\\n/g, '\\n');
}

content = normalize(content);
const nTarget1 = normalize(target1);
const nTarget2 = normalize(target2);

content = content.replace(nTarget1, repl1);
content = content.replace(nTarget2, repl2);

fs.writeFileSync('components/citylord/start/StartRunPageClient.tsx', content);
console.log("Patched successfully");
