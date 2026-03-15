
import { create } from 'zustand';
import { User, DetectionRecord, Alert } from '../types';

interface AppState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  detections: DetectionRecord[];
  alerts: Alert[];
  isDemoMode: boolean;

  setUser: (user: User | null, token: string | null, refreshToken?: string | null) => void;
  logout: () => void;
  addDetection: (detection: DetectionRecord) => void;
  setDetections: (detections: DetectionRecord[]) => void;
  setDemoMode: (val: boolean) => void;
}

const getInitialUser = (): User | null => {
  try {
    const saved = localStorage.getItem('user');
    if (!saved || saved === 'undefined') return null;
    return JSON.parse(saved);
  } catch (e) {
    console.warn("Failed to parse user from localStorage", e);
    return null;
  }
};

const getInitialRefreshToken = (): string | null =>
  typeof localStorage !== 'undefined' ? localStorage.getItem('refreshToken') : null;

export const useStore = create<AppState>((set) => ({
  user: getInitialUser(),
  token: typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null,
  refreshToken: getInitialRefreshToken(),
  detections: [],
  alerts: [
    {
      id: '1',
      severity: 'High',
      title: 'Rapid Shoreline Retreat',
      location: 'Grand Isle Basin',
      description: 'Erosion rate exceeded 5m in last 3 months.',
      timestamp: '2 hours ago',
      action: 'Prioritize rock armor deployment.'
    },
    {
      id: '2',
      severity: 'Medium',
      title: 'Invasive Species Sighting',
      location: 'Atchafalaya Delta',
      description: 'Nutria population increasing in primary nesting grounds.',
      timestamp: '1 day ago',
      action: 'Schedule trapping program.'
    }
  ],
  isDemoMode: true,

  setUser: (user, token, refreshToken = null) => {
    if (user && token) {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
      if (refreshToken != null) {
        localStorage.setItem('refreshToken', refreshToken);
      }
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    }
    set({
      user,
      token,
      refreshToken: refreshToken ?? (user && token ? localStorage.getItem('refreshToken') : null),
    });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    set({ user: null, token: null, refreshToken: null });
  },

  addDetection: (d) => set((state) => ({ 
    detections: [d, ...state.detections] 
  })),

  setDetections: (detections) => set({ detections }),
  setDemoMode: (val) => set({ isDemoMode: val })
}));
