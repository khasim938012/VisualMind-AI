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
  imageUrl: string | null;
  history: HistoryItem[];
  contextStack: { question: string, textRemaining: string }[];
  
  setStatus: (status: 'idle' | 'listening' | 'thinking' | 'explaining') => void;
  setTranscript: (text: string) => void;
  setExplanation: (text: string) => void;
  appendExplanation: (text: string) => void;
  setImageUrl: (url: string | null) => void;
  setHistory: (history: HistoryItem[]) => void;
  addHistoryItem: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  
  pushContext: (context: { question: string, textRemaining: string }) => void;
  popContext: () => { question: string, textRemaining: string } | undefined;
}

export const useStore = create<AppState>((set, get) => ({
  status: 'idle',
  transcript: '',
  explanation: '',
  imageUrl: null,
  history: [],
  contextStack: [],
  
  setStatus: (status) => set({ status }),
  setTranscript: (transcript) => set({ transcript }),
  setExplanation: (explanation) => set({ explanation }),
  appendExplanation: (text) => set((state) => ({ explanation: state.explanation + text })),
  setImageUrl: (imageUrl) => set({ imageUrl }),
  setHistory: (history) => set({ history }),
  addHistoryItem: (item) => set((state) => ({
    history: [...state.history, { ...item, id: Date.now(), timestamp: new Date().toISOString() }]
  })),
  
  pushContext: (ctx) => set((state) => ({ contextStack: [...state.contextStack, ctx] })),
  popContext: () => {
    const stack = [...get().contextStack];
    const ctx = stack.pop();
    set({ contextStack: stack });
    return ctx;
  }
}));
