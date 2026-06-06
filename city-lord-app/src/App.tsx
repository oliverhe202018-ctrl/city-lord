import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useStore } from './store/useStore';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import StartPage from './pages/StartPage';
import SocialPage from './pages/SocialPage';
import ProfilePage from './pages/ProfilePage';
import MissionsPage from './pages/MissionsPage';
import BottomNav from './components/BottomNav';

import { GameLayout } from './components/game/GameLayout';
import { ClientShell } from './components/ClientShell';
import { swrFetcher } from './lib/fetch-shim';
import { SWRConfig } from 'swr';

// Protected Route wrapper
const ProtectedRoute = () => {
  const { isAuthenticated } = useStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden">
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
  }, [checkAuth]);

  return (
    <SWRConfig value={{ fetcher: swrFetcher }}>
      <BrowserRouter>
        <ClientShell>
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
        </ClientShell>
      </BrowserRouter>
    </SWRConfig>
  );
}

export default App;
