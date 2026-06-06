import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Map, PlayCircle, Users, User } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'home', icon: Home, label: 'Home', path: '/home' },
    { id: 'map', icon: Map, label: 'Map', path: '/map' },
    { id: 'start', icon: PlayCircle, label: 'Start', path: '/start' },
    { id: 'social', icon: Users, label: 'Social', path: '/social' },
    { id: 'profile', icon: User, label: 'Profile', path: '/profile' }
  ];

  return (
    <div className="flex justify-around items-center h-12 bg-neutral-900 border-t border-neutral-800 pb-[env(safe-area-inset-bottom)] z-50">
      {tabs.map(tab => {
        const isActive = location.pathname.startsWith(tab.path);
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center justify-center w-full h-full ${isActive ? 'text-blue-500' : 'text-neutral-500'}`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}