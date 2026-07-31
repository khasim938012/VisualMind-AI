import React from 'react';
import { Sidebar } from './components/Sidebar';
import { VoiceController } from './components/VoiceController';
import { Scene } from './components/Scene';
import { useStore } from './store/useStore';
import './index.css';

const App: React.FC = () => {
  const { imageUrl, videoUrl } = useStore();

  return (
    <div className="app-container">
      {/* Full Screen Image Background with Cinematic Fade */}
      {imageUrl && (
        <div className="fullscreen-media">
            <img src={imageUrl} alt="Background" />
            <div className="vignette-overlay" />
        </div>
      )}

      {/* Full Screen Video Background */}
      {videoUrl && (
        <div className="fullscreen-media">
            <iframe 
                src={videoUrl} 
                frameBorder="0" 
                allow="autoplay; encrypted-media" 
                allowFullScreen
            />
            <div className="vignette-overlay" />
        </div>
      )}

      <Sidebar />
      <div className="main-content">
        <Scene />
        <VoiceController />
      </div>
    </div>
  );
}

export default App;
