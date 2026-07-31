import React from 'react';
import { Sidebar } from './components/Sidebar';
import { VoiceController } from './components/VoiceController';
import { Scene } from './components/Scene';

function App() {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Scene />
        <VoiceController />
      </div>
    </div>
  );
}

export default App;
