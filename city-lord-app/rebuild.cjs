const fs = require('fs');

let nextCode = fs.readFileSync('D:/project/city-lord/components/citylord/game-page-content.tsx', 'utf8');

const viteHeader = `
import { Suspense, lazy } from 'react';
const nextDynamic = (importFunc: () => Promise<any>, options: any = {}) => {
  const LazyComponent = lazy(() => importFunc().then((mod: any) => ({
    default: mod.default || Object.values(mod)[0]
  })));
  return (props: any) => (
    <Suspense fallback={options.loading ? options.loading() : null}>
      <LazyComponent {...props} />
    </Suspense>
  );
};
`;

nextCode = nextCode.replace('import nextDynamic from "next/dynamic"', viteHeader);
nextCode = nextCode.replace('"use client"', '');
nextCode = nextCode.replace('export function GamePageContent', 'export function GameLayout');
nextCode = nextCode.replace('import { useSearchParams } from \'next/navigation\'', 'import { useSearchParams, useLocation, useNavigate, Outlet } from \'react-router-dom\'');

nextCode = nextCode.replace(/const \[activeTab, setActiveTab\] = useState<TabType>\(\(\) => \{[\s\S]*?return 'home';\s*\n\s*\}\)/, 
  'const location = useLocation();\n  const navigate = useNavigate();\n  const rawTab = location.pathname.split(\'/\')[1] || \'home\';\n  const activeTab = (rawTab === \'map\' ? \'play\' : rawTab) as TabType;\n  const setActiveTab = useCallback((tab: string) => { navigate(`/${tab === \'play\' ? \'map\' : tab}`); }, [navigate]);');

nextCode = 'import { RunningTrackerContext } from \'@/contexts/RunningTrackerContext\';\n' + nextCode;

nextCode = nextCode.replace('      {hydrated && currentCity && (\n        <main className="relative flex-1 overflow-hidden">', 
`      {hydrated && currentCity && (
        <RunningTrackerContext.Provider value={{
          distance, pace, duration, calories, currentLocation, path, displayPath, closedPolygons, sessionClaims,
          isPaused: trackerIsPaused, togglePause: toggleTrackerPause, stop: stopTracker, clearRecovery, finalize,
          addManualLocation, setAnchorPoint, saveRun, distanceMeters, durationSeconds, steps, area, savedRunId,
          runNumber, damageSummary, maintenanceSummary, runIsValid, antiCheatLog, idempotencyKey, eventsHistory,
          activeRandomEvent, randomEventCountdownSeconds, lastAnnouncedKm, recoverUnfinishedSession,
          isRunning, isRunTakeoverActive, activeTab, setActiveTab, immersiveCurrentLocation, sessionHexes,
          handleTrackerPause, handleStopRun, handleManualLocationUpdate, handleExpand, handleHexClaimed, beginRunStart,
          handlePlannerOpen
        }}>
        <main className="relative flex-1 overflow-hidden">`);

nextCode = nextCode.replace(/          \{!isRunTakeoverActive && activeTab === "home" && \([\s\S]*?            <\/div>\n          \)\}\n        <\/main>\n      \)\}/, 
`          <div className="absolute inset-0 z-40 pointer-events-none flex flex-col">
            <Outlet />
          </div>
        </main>
        </RunningTrackerContext.Provider>
      )}`);

fs.writeFileSync('src/components/game/GameLayout.tsx', nextCode);
console.log('RECOVERED AND REFACTORED SUCCESSFULLY');
