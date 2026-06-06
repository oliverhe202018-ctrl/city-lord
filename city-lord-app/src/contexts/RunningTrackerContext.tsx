import { createContext, useContext } from 'react';
import type { useRunningTracker } from '@/hooks/useRunningTracker';

type RunningTrackerReturn = ReturnType<typeof useRunningTracker>;

interface RunningTrackerContextValue extends RunningTrackerReturn {
  isRunning: boolean;
  isRunTakeoverActive: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  immersiveCurrentLocation: { lat: number, lng: number } | undefined;
  sessionHexes: number;
  handleTrackerPause: () => void;
  handleStopRun: () => void;
  handleManualLocationUpdate: (lat: number, lng: number) => void;
  handleExpand: (expanded: boolean) => void;
  handleHexClaimed: (hex: any) => void;
  beginRunStart: (forceSkipCheck?: boolean) => Promise<boolean>;
  handlePlannerOpen: () => void;
}

export const RunningTrackerContext = createContext<RunningTrackerContextValue | null>(null);

export function useRunningTrackerContext() {
  const context = useContext(RunningTrackerContext);
  if (!context) {
    throw new Error('useRunningTrackerContext must be used within a RunningTrackerProvider');
  }
  return context;
}
