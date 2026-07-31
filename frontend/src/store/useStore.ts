import { create } from 'zustand';

interface HistoryItem {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AppState {
  status: 'idle' | 'listening' | 'thinking' | 'explaining';
  transcript: string;
  explanation: string;
  blueprint: any[];
  history: HistoryItem[];
  setStatus: (status: 'idle' | 'listening' | 'thinking' | 'explaining') => void;
  setTranscript: (text: string) => void;
  setExplanation: (text: string) => void;
  setBlueprint: (bp: any[]) => void;
  setHistory: (history: HistoryItem[]) => void;
  addHistoryItem: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const useStore = create<AppState>((set) => ({
  status: 'idle',
  transcript: '',
  explanation: '',
  blueprint: [],
  history: [],
  setStatus: (status) => set({ status }),
  setTranscript: (transcript) => set({ transcript }),
  setExplanation: (explanation) => set({ explanation }),
  setBlueprint: (blueprint) => set({ blueprint }),
  setHistory: (history) => set({ history }),
  addHistoryItem: (item) => set((state) => ({
    history: [...state.history, { ...item, id: Date.now(), timestamp: new Date().toISOString() }]
  }))
}));
