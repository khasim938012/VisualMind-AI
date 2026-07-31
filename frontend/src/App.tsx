import React from 'react';
import { Sidebar } from './components/Sidebar';
import { VoiceController } from './components/VoiceController';
import { Scene } from './components/Scene';
import { useStore } from './store/useStore';

function App() {
  const explanation = useStore(state => state.explanation);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Scene />
        {explanation && (
          <div className="explanation-overlay">
            <p className="cinematic-text">{explanation}</p>
          </div>
        )}
        <VoiceController />
      </div>
    </div>
  );
}

export default App;
