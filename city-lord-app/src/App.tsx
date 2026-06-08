import { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useStore } from './store/useStore';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const MapPage = lazy(() => import('./pages/MapPage'));
const StartPage = lazy(() => import('./pages/StartPage'));
const SocialPage = lazy(() => import('./pages/SocialPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const MissionsPage = lazy(() => import('./pages/MissionsPage'));

// Lazy load background authentication-dependent components
const PendingRunUploadRetry = lazy(() => import('./components/running/PendingRunUploadRetry').then(m => ({ default: m.PendingRunUploadRetry })));
const OfflineAchievementSync = lazy(() => import('./components/running/OfflineAchievementSync').then(m => ({ default: m.OfflineAchievementSync })));
const CelebrationOrchestrator = lazy(() => import('./components/running/RewardModal').then(m => ({ default: m.CelebrationOrchestrator })));

import { GameLayout } from './components/game/GameLayout';
import { ClientShell } from './components/ClientShell';
import { swrFetcher } from './lib/fetch-shim';
import { SWRConfig } from 'swr';
import { LoadingScreen } from '@/components/citylord/loading-screen';

// Loading Fallback
const LoadingFallback = () => {
  return <LoadingScreen message="正在加载城市数据..." />;
};

// Protected Route wrapper
const ProtectedRoute = () => {
  const { isAuthenticated, isHydrating } = useStore();
  if (isHydrating) return <LoadingFallback />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden">
      <Suspense fallback={null}>
        <PendingRunUploadRetry />
        <OfflineAchievementSync />
        <CelebrationOrchestrator />
      </Suspense>
      <GameLayout>
        <div className="flex-1 relative overflow-hidden h-[calc(100%-48px-env(safe-area-inset-bottom))] pointer-events-auto">
          <Outlet />
        </div>
      </GameLayout>
    </div>
  );
};

function App() {
  const { checkAuth } = useStore();

  useEffect(() => {
    checkAuth();
    
    // Listen for global logout events (e.g. from 401 interceptor)
    const handleLogout = () => {
      useStore.getState().logout();
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [checkAuth]);

  return (
    <SWRConfig value={{ 
      fetcher: swrFetcher, 
      revalidateOnFocus: false, 
      revalidateOnReconnect: false,
      onError: (error) => {
        if (error.isAuthError) return;
        console.error('SWR Error:', error);
      }
    }}>
      <HashRouter>
        <ClientShell>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/start" element={<StartPage />} />
                <Route path="/missions" element={<MissionsPage />} />
                <Route path="/social" element={<SocialPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Routes>
          </Suspense>
        </ClientShell>
      </HashRouter>
    </SWRConfig>
  );
}

export default App;
