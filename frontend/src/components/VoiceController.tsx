import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader } from 'lucide-react';
import { useStore } from '../store/useStore';
import axios from 'axios';

// Cross-browser support for Speech Recognition
const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const VoiceController: React.FC = () => {
  const { status, setStatus, setExplanation, setBlueprint, addHistoryItem } = useStore();
  const recognitionRef = useRef<any>(null);
  const synth = window.speechSynthesis;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');

  useEffect(() => {
    // Load voices
    const loadVoices = () => {
      const available = synth.getVoices();
      setVoices(available);
      if (available.length > 0) setSelectedVoice(available[0].name);
    };
    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }

    if (SpeechRecognitionAPI) {
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = false; // We handle restart manually for better control
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        
        // Handle Interruption
        if (synth.speaking) {
          synth.cancel();
          addHistoryItem({ role: 'assistant', content: "[Interrupted by user]" });
        }

        setStatus('thinking');
        addHistoryItem({ role: 'user', content: transcript });

        try {
          const res = await axios.post('http://localhost:3001/api/chat', { message: transcript });
          const { text, blueprint } = res.data;
          
          setExplanation(text);
          if (blueprint && blueprint.length > 0) setBlueprint(blueprint);
          addHistoryItem({ role: 'assistant', content: text });
          
          // Speak the explanation
          speak(text);
        } catch (error) {
          console.error("Backend error", error);
          const errorMsg = "Sorry, I couldn't connect to my brain.";
          setExplanation(errorMsg);
          speak(errorMsg);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'aborted') setStatus('idle');
      };

      recognitionRef.current.onend = () => {
        // If we were supposed to be listening but it ended, stay idle unless we are explaining
        if (status === 'listening') setStatus('idle');
      };
    }
  }, []);

  const speak = (text: string) => {
    setStatus('explaining');
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) utterance.voice = voice;
    
    utterance.onend = () => {
      setStatus('idle');
    };
    
    synth.speak(utterance);
  };

  const toggleListen = () => {
    if (status === 'listening') {
      recognitionRef.current?.stop();
      setStatus('idle');
    } else {
      if (synth.speaking) synth.cancel();
      recognitionRef.current?.start();
      setStatus('listening');
    }
  };

  return (
    <div className="voice-controls">
      {status === 'explaining' && <div className="status-text">Explaining...</div>}
      {status === 'thinking' && <div className="status-text">Thinking...</div>}
      {status === 'listening' && <div className="status-text">Listening...</div>}
      
      <button 
        className={`mic-button ${status === 'listening' ? 'listening' : ''}`}
        onClick={toggleListen}
        disabled={status === 'thinking'}
      >
        {status === 'thinking' ? <Loader className="animate-spin" /> : (status === 'listening' ? <Mic /> : <MicOff />)}
      </button>

      <select 
        value={selectedVoice} 
        onChange={(e) => setSelectedVoice(e.target.value)}
        style={{ marginTop: '10px', background: 'var(--panel-bg)', color: 'white', border: '1px solid gray', borderRadius: '4px', padding: '5px' }}
      >
        {voices.map(v => (
          <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
        ))}
      </select>
    </div>
  );
};
