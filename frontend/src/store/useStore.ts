import { create } from 'zustand';

interface HistoryItem {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface SessionItem {
  id: string;
  title: string;
  timestamp: string;
}

interface AppState {
  status: 'idle' | 'listening' | 'thinking' | 'explaining';
  transcript: string;
  explanation: string;
  imageUrl: string | null;
  videoUrl: string | null;
  modelName: string | null;
  animationData: { pistons: string, blockOpacity: number, explode: boolean } | null;
  history: HistoryItem[];
  sessions: SessionItem[];
  currentSessionId: string;
  contextStack: { question: string, textRemaining: string }[];
  
  setStatus: (status: 'idle' | 'listening' | 'thinking' | 'explaining') => void;
  setTranscript: (text: string) => void;
  setExplanation: (text: string) => void;
  appendExplanation: (text: string) => void;
  setImageUrl: (url: string | null) => void;
  setVideoUrl: (url: string | null) => void;
  setModelName: (name: string | null) => void;
  setAnimationData: (data: any) => void;
  setHistory: (history: HistoryItem[]) => void;
  setSessions: (sessions: SessionItem[]) => void;
  setCurrentSessionId: (id: string) => void;
  startNewChat: () => void;
  addHistoryItem: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  
  pushContext: (context: { question: string, textRemaining: string }) => void;
  popContext: () => { question: string, textRemaining: string } | undefined;
}

export const useStore = create<AppState>((set, get) => ({
  status: 'idle',
  transcript: '',
  explanation: '',
  imageUrl: null,
  videoUrl: null,
  modelName: null,
  animationData: null,
  history: [],
  sessions: [],
  currentSessionId: 'default',
  contextStack: [],
  
  setStatus: (status) => set({ status }),
  setTranscript: (transcript) => set({ transcript }),
  setExplanation: (explanation) => set({ explanation }),
  appendExplanation: (text) => set((state) => ({ explanation: state.explanation + text })),
  setImageUrl: (imageUrl) => set({ imageUrl, videoUrl: null, modelName: null }),
  setVideoUrl: (videoUrl) => set({ videoUrl, imageUrl: null, modelName: null }),
  setModelName: (modelName) => set({ modelName, imageUrl: null, videoUrl: null }),
  setAnimationData: (animationData) => set({ animationData }),
  setHistory: (history) => set({ history }),
  setSessions: (sessions) => set({ sessions }),
  setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
  startNewChat: () => set({
      currentSessionId: Date.now().toString(),
      history: [],
      imageUrl: null,
      videoUrl: null,
      modelName: null,
      animationData: null,
      explanation: '',
      transcript: ''
  }),
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
