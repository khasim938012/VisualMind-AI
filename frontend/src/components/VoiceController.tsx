import React, { useEffect, useRef, useState } from 'react';
import { Mic, Loader } from 'lucide-react';
import { useStore } from '../store/useStore';
import axios from 'axios';

const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const VoiceController: React.FC = () => {
  const { status, setStatus, explanation, setExplanation, setImageUrl, addHistoryItem, pushContext, popContext } = useStore();
  const recognitionRef = useRef<any>(null);
  const synth = window.speechSynthesis;
  
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  
  // Streaming state
  const utteranceQueue = useRef<string[]>([]);
  const isSpeaking = useRef(false);
  const currentSentence = useRef('');
  const remainingStreamText = useRef(''); // For interruption

  useEffect(() => {
    const loadVoices = () => {
      const available = synth.getVoices();
      setVoices(available);
      if (available.length > 0) setSelectedVoice(available[0].name);
    };
    loadVoices();
    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;

    if (SpeechRecognitionAPI) {
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = true; // Always on
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        handleUserQuery(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') setStatus('idle');
      };

      recognitionRef.current.onend = () => {
        // Auto restart for continuous listening
        if (status === 'listening' || status === 'explaining' || status === 'thinking') {
            try { recognitionRef.current.start(); } catch(e){}
        }
      };
    }
  }, []);

  const handleUserQuery = async (query: string) => {
    // Interruption Logic
    if (status === 'explaining' || status === 'thinking') {
        synth.cancel();
        isSpeaking.current = false;
        utteranceQueue.current = [];
        
        // Save current context if there is substantial text left
        if (remainingStreamText.current.length > 20) {
            pushContext({ question: query, textRemaining: remainingStreamText.current });
        }
    }

    setStatus('thinking');
    setExplanation('');
    setSubtitle('');
    remainingStreamText.current = '';
    addHistoryItem({ role: 'user', content: query });

    fetchStream(query);
  };

  const fetchStream = async (query: string) => {
    try {
        const url = `http://localhost:3001/api/chat/stream?message=${encodeURIComponent(query)}`;
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            if (event.data === '[DONE]') {
                eventSource.close();
                // Check if we need to pop context after speaking finishes
                return;
            }

            try {
                const data = JSON.parse(event.data);
                if (data.chunk) {
                    processChunk(data.chunk);
                }
            } catch(e) {}
        };
        
        eventSource.onerror = () => {
            eventSource.close();
            setStatus('listening');
        };
    } catch (e) {
        setStatus('listening');
    }
  };

  const processChunk = (chunk: string) => {
    // Check for image tag
    const imgMatch = chunk.match(/\[IMAGE:(.*?)\]/);
    let textChunk = chunk;
    if (imgMatch) {
        fetchWikipediaImage(imgMatch[1].trim());
        textChunk = chunk.replace(/\[IMAGE:.*?\]/, '');
    }

    remainingStreamText.current += textChunk;
    currentSentence.current += textChunk;

    // Split by sentence boundaries to speak in natural chunks
    if (currentSentence.current.match(/[.!?]\s/)) {
        const sentence = currentSentence.current;
        currentSentence.current = '';
        utteranceQueue.current.push(sentence);
        processQueue();
    }
  };

  const processQueue = () => {
    if (isSpeaking.current || utteranceQueue.current.length === 0) return;
    
    isSpeaking.current = true;
    setStatus('explaining');
    const textToSpeak = utteranceQueue.current.shift() || '';
    
    // Update subtitle display (last 2 sentences roughly)
    setSubtitle(prev => {
        const combined = prev + ' ' + textToSpeak;
        const words = combined.split(' ');
        if (words.length > 25) return words.slice(-25).join(' '); // Keep it short
        return combined;
    });

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) utterance.voice = voice;
    
    utterance.onend = () => {
        isSpeaking.current = false;
        
        if (utteranceQueue.current.length > 0) {
            processQueue();
        } else {
            // Queue empty, check if stream is done by checking currentSentence
            if (currentSentence.current.trim() === '') {
                // Done explaining this thought. Check context stack.
                const ctx = popContext();
                if (ctx) {
                    setTimeout(() => {
                        const resumePhrase = " Returning to the previous topic... ";
                        currentSentence.current = resumePhrase + ctx.textRemaining;
                        remainingStreamText.current = ctx.textRemaining;
                        utteranceQueue.current.push(currentSentence.current);
                        currentSentence.current = '';
                        processQueue();
                    }, 1000);
                } else {
                    setStatus('listening');
                    setSubtitle('');
                }
            }
        }
    };
    
    synth.speak(utterance);
  };

  const fetchWikipediaImage = async (query: string) => {
    try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${encodeURIComponent(query)}&origin=*`;
        const res = await axios.get(url);
        const pages = res.data.query.pages;
        const pageId = Object.keys(pages)[0];
        if (pages[pageId].original) {
            setImageUrl(pages[pageId].original.source);
        } else {
            setImageUrl(null);
        }
    } catch(e) {
        setImageUrl(null);
    }
  };

  const startListening = () => {
    try { recognitionRef.current?.start(); } catch(e){}
    setStatus('listening');
  };

  return (
    <div className="voice-controller-wrapper">
      {status === 'explaining' && subtitle && (
        <div className="subtitle-container">
          <p className="cinematic-text">{subtitle}</p>
        </div>
      )}

      <div className="voice-controls">
        <button 
          className={`mic-button ${status === 'listening' ? 'listening' : ''} ${status === 'thinking' ? 'thinking' : ''}`}
          onClick={startListening}
        >
          {status === 'thinking' ? <Loader className="animate-spin" /> : <Mic />}
        </button>

        <div className="settings-row">
          <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}>
            {voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
          </select>
        </div>
      </div>
    </div>
  );
};
