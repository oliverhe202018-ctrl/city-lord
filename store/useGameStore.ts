import { create, StateCreator } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { Room } from '@/types/room';

import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { touchUserActivity } from '@/app/actions/user';

// ==================== Types ====================

export type GameMode = 'map' | 'single' | 'private' | 'club';

export interface UserState {
  userId: string;
  nickname: string;
  level: number;
  currentExp: number;
  maxExp: number;
  coins: number;
  stamina: number;
  maxStamina: number;
  lastStaminaUpdate: number;
  totalArea: number;
  totalDistance: number; // in meters
  avatar: string;
  achievements: Record<string, boolean>; // id -> claimed
  unreadMessageCount: number;
}

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  adcode: string | null;
  countyName: string | null;
  cityName: string | null;
  isRunning: boolean;
  lastUpdate: number | null;
  speed: number;
  distance: number;
  duration: number;
  gpsStatus: 'locating' | 'success' | 'error' | 'weak';
  gpsError?: string;
  hasDismissedGeolocationPrompt: boolean;
  runStartTime: number | null;
  currentRunPath: [number, number][];
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  quantity: number;
  type: 'stamina' | 'exp' | 'area' | 'special';
  effect: {
    value: number;
    duration?: number;
  };
}

export interface InventoryState {
  items: Map<string, InventoryItem>;
  totalItems: number;
}

export interface HexState {
  id: string;
  status: 'owned' | 'enemy' | 'neutral' | 'contested' | 'fog';
  level: number;
  ownerName?: string;
  lastActivity?: string;
}

export interface WorldState {
  hexes: Map<string, HexState>;
}

export interface AppSettings {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface MyClub {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  level: string;
  description?: string | null;
  avatar_url?: string | null;
  status?: 'active' | 'pending' | 'rejected';
  audit_reason?: string | null;
}

// ==================== Actions ====================

export interface ModeActions {
  setGameMode: (mode: GameMode) => void;
  setMyClub: (club: MyClub | null) => void;
  updateMyClubInfo: (info: Partial<MyClub>) => void;
  updateAppSettings: (settings: Partial<AppSettings>) => void;
  setCurrentRoom: (room: Room | null) => void;
  syncCurrentRoom: () => Promise<void>;
}

export interface UserActions {
  setNickname: (nickname: string) => void;
  setUnreadMessageCount: (count: number) => void;
  addExperience: (amount: number) => void;
  addCoins: (amount: number) => void;
  levelUp: () => void;
  consumeStamina: (amount: number) => void;
  restoreStamina: (amount: number) => void;
  checkStaminaRecovery: () => void;
  addTotalArea: (amount: number) => void;
  addTotalDistance: (amount: number) => void;
  setAvatar: (avatar: string) => void;
  claimAchievement: (id: string) => void;
  resetUser: () => void;
  syncUserProfile: () => Promise<void>;
  touchActivity: () => Promise<void>;
}

export interface LocationActions {
  updateLocation: (lat: number, lng: number) => void;
  setRegion: (adcode: string, cityName: string, countyName: string) => void;
  startRunning: () => void;
  stopRunning: () => void;
  updateSpeed: (speed: number) => void;
  addDistance: (distance: number) => void;
  updateDuration: () => void;
  resetLocation: () => void;
  setGpsStatus: (status: 'locating' | 'success' | 'error' | 'weak', error?: string) => void;
  clearGpsError: () => void;
  dismissGeolocationPrompt: () => void;
  resetRunState: () => void;
}

export interface InventoryActions {
  addItem: (item: InventoryItem) => void;
  removeItem: (itemId: string, quantity?: number) => void;
  useItem: (itemId: string) => void;
  getItemCount: (itemId: string) => number;
  resetInventory: () => void;
}

export interface WorldActions {
  occupyHex: (hexId: string) => void;
  attackHex: (hexId: string) => void;
  updateHex: (hexId: string, data: Partial<HexState>) => void;
}

// Combined State and Actions
export interface GameState extends UserState, LocationState, InventoryState, WorldState {
  gameMode: GameMode;
  myClub: MyClub | null;
  appSettings: AppSettings;
  currentRoom: Room | null;
}

export interface GameActions extends ModeActions, UserActions, LocationActions, InventoryActions, WorldActions {}

export type GameStore = GameState & GameActions;

// ==================== Initial State ====================

const initialAppSettings: AppSettings = {
  soundEnabled: true,
  hapticEnabled: true,
  theme: 'system',
};

const initialUserState: UserState = {
  userId: 'user_' + Date.now(),
  nickname: '玩家',
  level: 1,
  currentExp: 0,
  maxExp: 1000,
  coins: 0,
  stamina: 100,
  maxStamina: 100,
  lastStaminaUpdate: Date.now(),
  totalArea: 0,
  totalDistance: 0,
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
  achievements: {},
  unreadMessageCount: 0,
};

const initialLocationState: LocationState = {
  latitude: null,
  longitude: null,
  adcode: null,
  cityName: null,
  countyName: null,
  isRunning: false,
  lastUpdate: null,
  speed: 0,
  distance: 0,
  duration: 0,
  gpsStatus: 'locating',
  hasDismissedGeolocationPrompt: false,
  runStartTime: null,
  currentRunPath: [],
};

const initialInventoryState: InventoryState = {
  items: new Map(),
  totalItems: 0,
};

const initialWorldState: WorldState = {
  hexes: new Map(),
};

// ==================== Slices ====================

const createModeSlice: StateCreator<GameStore, [], [], ModeActions> = (set, get) => ({
  setGameMode: (mode) => set({ gameMode: mode }),
  setMyClub: (club) => set({ myClub: club }),
  updateMyClubInfo: (info) =>
    set((state) => ({
      myClub: state.myClub ? { ...state.myClub, ...info } : null,
    })),
  updateAppSettings: (settings) =>
    set((state) => ({ appSettings: { ...state.appSettings, ...settings } })),
  setCurrentRoom: (room) => set({ currentRoom: room }),
  syncCurrentRoom: async () => {
    const { currentRoom } = get();
    if (!currentRoom?.id) return;

    try {
      const supabase = createClient();
      
      // 2. Query Room Details
      const { data: room, error } = await supabase
        .from('rooms')
        .select(`
          *,
          host:profiles!host_id(nickname),
          participants:room_participants(
            user_id,
            joined_at,
            total_score,
            territory_area,
            territory_ratio,
            stolen_lands,
            lost_lands,
            rivals_defeated,
            growth_rate,
            status,
            profile:profiles!user_id(nickname, avatar_url, level)
          )
        `)
        .eq('id', currentRoom.id)
        .single();

      // 3. Handle Result
      if (error || !room) {
        // Safe check for error code using optional chaining
        if (!room || (error as any)?.code === 'PGRST116') {
           // Room not found (PGRST116 is JSON/Single row error, often means 0 rows)
           console.warn('Sync Room: Room not found, clearing state');
           set({ currentRoom: null });
           toast.error('房间已解散');
        } else {
           console.error('Sync Room Error:', error);
           // Do not clear state on network error
        }
        return;
      }

      // Transform participants
      const roomData = room as any;
      const participants = roomData.participants.map((p: any) => ({
           id: p.user_id,
           nickname: p.profile?.nickname || 'Unknown',
           avatar_url: p.profile?.avatar_url,
           level: p.profile?.level || 1,
           joined_at: p.joined_at,
           total_score: p.total_score || 0,
           territory_area: p.territory_area || 0,
           territory_ratio: p.territory_ratio || 0,
           stolen_lands: p.stolen_lands || 0,
           lost_lands: p.lost_lands || 0,
           rivals_defeated: p.rivals_defeated || 0,
           growth_rate: p.growth_rate || 0,
           status: p.status || 'active'
      }));

      // Update State
      set({
        currentRoom: {
          id: roomData.id,
          name: roomData.name,
          host_id: roomData.host_id,
          host_name: roomData.host?.nickname || 'Unknown',
          target_distance_km: roomData.target_distance_km,
          target_duration_minutes: roomData.target_duration_minutes,
          max_participants: roomData.max_participants,
          participants_count: participants.length,
          is_private: roomData.is_private,
          is_locked: roomData.is_private,
          status: roomData.status,
          created_at: roomData.created_at,
          participants: participants
        } as Room
      });
      console.log('Sync Room: Success', roomData.name);

    } catch (e) {
      console.error('Sync Room Exception:', e);
    }
  }
});

const createUserSlice: StateCreator<GameStore, [], [], UserActions> = (set, get) => ({
  setNickname: (nickname) => set({ nickname }),
  setUnreadMessageCount: (count) => set({ unreadMessageCount: count }),
  addExperience: (amount) => set((state) => {
    const newExp = state.currentExp + amount;
    const newLevel = Math.floor(newExp / 1000) + 1; // Simplified leveling
    
    if (newLevel > state.level) {
      get().levelUp();
    }
    
    return { currentExp: newExp, level: newLevel };
  }),
  addCoins: (amount) => set((state) => ({ coins: (state.coins || 0) + amount })),
  levelUp: () => {
    const state = get();
    const newLevel = state.level + 1;
    
    toast.success(`升级啦！达到等级 ${newLevel}`, {
      description: "获得体力上限 +10",
      icon: "🎉"
    });
    
    set({ 
      level: newLevel,
      maxStamina: 100 + (newLevel * 10),
      stamina: state.stamina + 20 // Bonus stamina on level up
    });
  },
  consumeStamina: (amount) => set((state) => {
    if (state.stamina < amount) return state;
    return { stamina: state.stamina - amount };
  }),
  restoreStamina: (amount) => set((state) => ({
    stamina: Math.min(state.stamina + amount, state.maxStamina)
  })),
  checkStaminaRecovery: () => set((state) => {
    const now = Date.now();
    const timeDiff = now - state.lastStaminaUpdate;
    const recoveryInterval = 5 * 60 * 1000; // 5 minutes
    
    if (timeDiff >= recoveryInterval && state.stamina < state.maxStamina) {
      const recoveredAmount = Math.floor(timeDiff / recoveryInterval);
      const newStamina = Math.min(state.stamina + recoveredAmount, state.maxStamina);
      
      return {
        stamina: newStamina,
        lastStaminaUpdate: now - (timeDiff % recoveryInterval)
      };
    }
    return state;
  }),
  addTotalArea: (amount) => set((state) => ({
    totalArea: state.totalArea + amount
  })),
  addTotalDistance: (amount) => set((state) => ({
    totalDistance: (state.totalDistance || 0) + amount
  })),
  setAvatar: (avatar) => set({ avatar }),
  claimAchievement: (id) => set((state) => ({
    achievements: { ...state.achievements, [id]: true }
  })),
  resetUser: () => set(initialUserState),
  syncUserProfile: async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        const profileData = profile as any;
        set((state) => ({
          level: profileData.level,
          currentExp: profileData.current_exp || state.currentExp,
          coins: profileData.coins || state.coins,
          totalArea: profileData.total_area || state.totalArea,
          totalDistance: (profileData.total_distance_km * 1000) || state.totalDistance,
        }));
      }
    } catch (error) {
      console.error("Failed to sync user profile:", error);
    }
  },
  touchActivity: async () => {
    try {
      await touchUserActivity();
    } catch (error: any) {
      if (error?.name !== 'AbortError' && error?.digest !== 'NEXT_REDIRECT') {
        console.error('Failed to touch user activity:', error);
      }
    }
  },
});

const createLocationSlice: StateCreator<GameStore, [], [], LocationActions> = (set, get) => ({
  updateLocation: (lat, lng) => set((state) => {
    const newPath = state.isRunning ? [...state.currentRunPath, [lat, lng] as [number, number]] : state.currentRunPath;
    // Limit to 1000 points to prevent storage issues
    if (newPath.length > 1000) {
        newPath.splice(0, newPath.length - 1000);
    }
    return {
        latitude: lat,
        longitude: lng,
        lastUpdate: Date.now(),
        currentRunPath: newPath
    };
  }),
  setRegion: (adcode, cityName, countyName) => set({ adcode, cityName, countyName }),
  startRunning: () => set({ isRunning: true, lastUpdate: Date.now(), runStartTime: Date.now(), currentRunPath: [] }),
  stopRunning: () => set({ isRunning: false, speed: 0 }),
  updateSpeed: (speed) => set({ speed }),
  addDistance: (distance) => {
    const state = get();
    set({ distance: state.distance + distance });
  },
  updateDuration: () => {
    const state = get();
    if (!state.lastUpdate) return;
    const now = Date.now();
    const elapsed = (now - state.lastUpdate) / 1000;
    set({ duration: state.duration + elapsed, lastUpdate: now });
  },
  resetLocation: () => {
    const state = get();
    set({ ...initialLocationState, hasDismissedGeolocationPrompt: state.hasDismissedGeolocationPrompt });
  },
  setGpsStatus: (status, error) => set({ gpsStatus: status, gpsError: error }),
  clearGpsError: () => set({ gpsError: undefined }),
  dismissGeolocationPrompt: () => set({ hasDismissedGeolocationPrompt: true, gpsError: undefined }),
  resetRunState: () => set({
    isRunning: false,
    runStartTime: null,
    distance: 0,
    duration: 0,
    currentRunPath: [],
    speed: 0,
  }),
});

const createInventorySlice: StateCreator<GameStore, [], [], InventoryActions> = (set, get) => ({
  addItem: (item) => {
    const state = get();
    const newItems = new Map(state.items);
    const existing = newItems.get(item.id);
    if (existing) {
      newItems.set(item.id, { ...existing, quantity: existing.quantity + item.quantity });
    } else {
      newItems.set(item.id, item);
    }
    set({ items: newItems, totalItems: state.totalItems + item.quantity });
  },
  removeItem: (itemId, quantity = 1) => {
    const state = get();
    const newItems = new Map(state.items);
    const item = newItems.get(itemId);
    if (!item) return;

    const removeCount = Math.min(item.quantity, quantity);
    if (item.quantity <= removeCount) {
      newItems.delete(itemId);
    } else {
      newItems.set(itemId, { ...item, quantity: item.quantity - removeCount });
    }
    set({ items: newItems, totalItems: state.totalItems - removeCount });
  },
  useItem: (itemId) => {
    const item = get().items.get(itemId);
    if (!item || item.quantity <= 0) return;
    switch (item.type) {
      case 'stamina':
        get().restoreStamina(item.effect.value);
        break;
      case 'exp':
        get().addExperience(item.effect.value);
        break;
      case 'area':
        get().addTotalArea(item.effect.value);
        break;
      case 'special':
        break;
    }
    get().removeItem(itemId, 1);
  },
  getItemCount: (itemId) => get().items.get(itemId)?.quantity ?? 0,
  resetInventory: () => set(initialInventoryState),
});

const createWorldSlice: StateCreator<GameStore, [], [], WorldActions> = (set, get) => ({
  occupyHex: (hexId) => {
    const { hexes, stamina, nickname } = get();
    if (hexes.get(hexId)?.status === 'owned' || stamina < 10) return;

    get().consumeStamina(10);
    get().addTotalArea(1);
    get().addExperience(50);

    const newHexes = new Map(hexes);
    newHexes.set(hexId, {
      id: hexId,
      status: 'owned',
      level: 1,
      ownerName: nickname,
      lastActivity: new Date().toISOString(),
    });
    set({ hexes: newHexes });
  },
  attackHex: (hexId) => {
    /* ... */
  },
  updateHex: (hexId, data) => {
    const state = get();
    const newHexes = new Map(state.hexes);
    const existing = newHexes.get(hexId);
    if (existing) {
      newHexes.set(hexId, { ...existing, ...data });
      set({ hexes: newHexes });
    }
  },
});

// ==================== Store ====================

const ssrSafeLocalStorage: StateStorage = {
  getItem: (name: string): string | Promise<string | null> | null => {
    if (typeof window === 'undefined') {
      return null;
    }
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string): void | Promise<void> => {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(name, value);
  },
  removeItem: (name: string): void | Promise<void> => {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.removeItem(name);
  },
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get, api) => ({
      // Initial State
      gameMode: 'map',
      myClub: null,
      currentRoom: null,
      appSettings: initialAppSettings,
      ...initialUserState,
      ...initialLocationState,
      ...initialInventoryState,
      ...initialWorldState,

      // Actions
      ...createModeSlice(set, get, api),
      ...createUserSlice(set, get, api),
      ...createLocationSlice(set, get, api),
      ...createInventorySlice(set, get, api),
      ...createWorldSlice(set, get, api),
    }),
    {
      name: 'city-lord-storage',
      storage: createJSONStorage(() => ssrSafeLocalStorage, {
        reviver: (key, value) => {
          if (key === 'items' || key === 'hexes') {
            return new Map(value as [string, any][]);
          }
          return value;
        },
        replacer: (key, value) => {
          if (value instanceof Map) {
            return Array.from(value.entries());
          }
          return value;
        },
      }),
      partialize: (state) => ({
        // User Profile
        userId: state.userId,
        nickname: state.nickname,
        level: state.level,
        currentExp: state.currentExp,
        maxExp: state.maxExp,
        coins: state.coins,
        stamina: state.stamina,
        maxStamina: state.maxStamina,
        lastStaminaUpdate: state.lastStaminaUpdate,
        totalArea: state.totalArea,
        totalDistance: state.totalDistance,
        avatar: state.avatar,
        achievements: state.achievements,
        unreadMessageCount: state.unreadMessageCount,
        // My Club
        myClub: state.myClub,
        // Current Room
        currentRoom: state.currentRoom,
        // App Settings
        appSettings: state.appSettings,
        // Running Session Recovery
        isRunning: state.isRunning,
        runStartTime: state.runStartTime,
        distance: state.distance,
        duration: state.duration,
        currentRunPath: state.currentRunPath,
        latitude: state.latitude,
        longitude: state.longitude,
      } as unknown as GameStore),
    },
  ),
);

// Hooks for specific parts of the state - use stable references to avoid infinite loops
export const useGameActions = () => {
  return useGameStore(
    useShallow((state) => ({
      // Mode Actions
      setGameMode: state.setGameMode,
      setMyClub: state.setMyClub,
      updateMyClubInfo: state.updateMyClubInfo,
      updateAppSettings: state.updateAppSettings,
      setCurrentRoom: state.setCurrentRoom,
      syncCurrentRoom: state.syncCurrentRoom,
      
      // User Actions
      setNickname: state.setNickname,
      setUnreadMessageCount: state.setUnreadMessageCount,
      addExperience: state.addExperience,
      addCoins: state.addCoins,
      levelUp: state.levelUp,
      consumeStamina: state.consumeStamina,
      restoreStamina: state.restoreStamina,
      checkStaminaRecovery: state.checkStaminaRecovery,
      addTotalArea: state.addTotalArea,
      addTotalDistance: state.addTotalDistance,
      setAvatar: state.setAvatar,
      claimAchievement: state.claimAchievement,
      syncUserProfile: state.syncUserProfile,
      resetUser: state.resetUser,

      // Location Actions
      updateLocation: state.updateLocation,
      setRegion: state.setRegion,
      startRunning: state.startRunning,
      stopRunning: state.stopRunning,
      updateSpeed: state.updateSpeed,
      addDistance: state.addDistance,
      updateDuration: state.updateDuration,
      resetLocation: state.resetLocation,
      setGpsStatus: state.setGpsStatus,
      clearGpsError: state.clearGpsError,
      dismissGeolocationPrompt: state.dismissGeolocationPrompt,
      resetRunState: state.resetRunState,

      // Inventory Actions
      addItem: state.addItem,
      removeItem: state.removeItem,
      useItem: state.useItem,
      getItemCount: state.getItemCount,
      resetInventory: state.resetInventory,

      // World Actions
      occupyHex: state.occupyHex,
      attackHex: state.attackHex,
      updateHex: state.updateHex,
    }))
  );
};
export const useGameUser = () =>
  useGameStore(
    useShallow((state) => ({
      userId: state.userId,
      nickname: state.nickname,
      level: state.level,
      currentExp: state.currentExp,
      maxExp: state.maxExp,
      stamina: state.stamina,
      maxStamina: state.maxStamina,
      lastStaminaUpdate: state.lastStaminaUpdate,
      totalArea: state.totalArea,
      totalDistance: state.totalDistance,
      avatar: state.avatar,
      achievements: state.achievements,
      unreadMessageCount: state.unreadMessageCount,
    })),
  );
export const useGameLocation = () =>
  useGameStore(
    useShallow((state) => ({
      latitude: state.latitude,
      longitude: state.longitude,
      adcode: state.adcode,
      countyName: state.countyName,
      cityName: state.cityName,
      isRunning: state.isRunning,
      lastUpdate: state.lastUpdate,
      speed: state.speed,
      distance: state.distance,
      duration: state.duration,
      gpsStatus: state.gpsStatus,
      gpsError: state.gpsError,
      hasDismissedGeolocationPrompt: state.hasDismissedGeolocationPrompt,
    })),
  );
export const useGameInventory = () => useGameStore(useShallow((state) => ({ items: state.items, totalItems: state.totalItems })));
export const useGameWorld = () => useGameStore(useShallow((state) => ({ hexes: state.hexes })));
