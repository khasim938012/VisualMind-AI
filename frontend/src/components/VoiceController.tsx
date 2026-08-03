import React, { useEffect, useRef, useState } from 'react';
import { Mic, Loader } from 'lucide-react';
import { useStore } from '../store/useStore';
import axios from 'axios';

const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const VoiceController: React.FC = () => {
  const { status, setStatus, setImageUrl, setVideoUrl, setModelName, addHistoryItem, pushContext, popContext } = useStore();
  const recognitionRef = useRef<any>(null);
  const synth = window.speechSynthesis;
  
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const isMutedRef = useRef(false);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  
  // Streaming state
  const utteranceQueue = useRef<string[]>([]);
  const isSpeaking = useRef(false);
  const currentSentence = useRef('');
  const remainingStreamText = useRef(''); // For interruption
  const rawBuffer = useRef(''); // For tag parsing
  const activeEventSource = useRef<EventSource | null>(null);
  const imageCache = useRef<Record<string, string>>({});

  const { currentSessionId } = useStore();
  
  // Clear subtitle and stop speaking when a new chat starts
  useEffect(() => {
     setSubtitle('');
     utteranceQueue.current = [];
     isSpeaking.current = false;
     imageCache.current = {};
     synth.cancel();
  }, [currentSessionId]);

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
        // Auto restart for continuous listening unless muted
        if (!isMutedRef.current && (statusRef.current === 'listening' || statusRef.current === 'explaining' || statusRef.current === 'thinking')) {
            try { recognitionRef.current.start(); } catch(e){}
        }
      };
    }
  }, []);

  const toggleMute = () => {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      isMutedRef.current = newMuted;
      if (newMuted) {
          try { recognitionRef.current?.stop(); } catch(e){}
          setStatus('idle');
      } else {
          startListening();
      }
  };

  const handleUserQuery = async (query: string) => {
    // Interruption Logic
    const currentStatus = useStore.getState().status;
    if (currentStatus === 'explaining' || currentStatus === 'thinking' || currentStatus === 'listening') {
        synth.cancel();
        isSpeaking.current = false;
        utteranceQueue.current = [];
        
        // Kill any active stream from the backend
        if (activeEventSource.current) {
            activeEventSource.current.close();
            activeEventSource.current = null;
        }
        
        // Save current context if there is substantial text left
        if (remainingStreamText.current.length > 20) {
            pushContext({ question: query, textRemaining: remainingStreamText.current });
        }
    }

    setStatus('thinking');
    setSubtitle('');
    setImageUrl(null);
    setVideoUrl(null);
    setModelName(null);
    useStore.getState().setAnimationData(null);
    remainingStreamText.current = '';
    rawBuffer.current = '';
    addHistoryItem({ role: 'user', content: query });

    fetchStream(query);
  };

  const fetchStream = async (query: string) => {
    try {
        const sessionId = useStore.getState().currentSessionId;
        const url = `http://localhost:3001/api/chat/stream?message=${encodeURIComponent(query)}&sessionId=${sessionId}`;
        
        if (activeEventSource.current) activeEventSource.current.close();
        const eventSource = new EventSource(url);
        activeEventSource.current = eventSource;

        eventSource.onmessage = (event) => {
            if (event.data === '[DONE]') {
                eventSource.close();
                
                // Flush anything left in the rawBuffer as a sentence if it exists and has no unclosed tags
                if (rawBuffer.current && !rawBuffer.current.includes('[')) {
                    currentSentence.current += rawBuffer.current;
                    rawBuffer.current = '';
                }
                if (currentSentence.current.trim() !== '') {
                    utteranceQueue.current.push(currentSentence.current);
                    currentSentence.current = '';
                }
                
                // START PRESENTATION ONLY WHEN FULLY DONE THINKING
                // This perfectly simulates taking a moment to plan and collect all images before starting.
                processQueue();
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
    rawBuffer.current += chunk;

    // Check for Image tag
    let imgMatch;
    while ((imgMatch = rawBuffer.current.match(/\[IMAGE:(.*?)\]/))) {
        const term = imgMatch[1].trim();
        fetchWikimediaImage(term).then(url => {
            if (url) imageCache.current[term] = url;
        });
        rawBuffer.current = rawBuffer.current.replace(/\[IMAGE:.*?\]/, `{|IMG:${term}|}`);
    }

    // Check for Video tag
    let vidMatch;
    while ((vidMatch = rawBuffer.current.match(/\[VIDEO:(.*?)\]/))) {
        rawBuffer.current = rawBuffer.current.replace(/\[VIDEO:.*?\]/, `{|VID:${vidMatch[1].trim()}|}`);
    }

    // Check for Model tag
    let modMatch;
    while ((modMatch = rawBuffer.current.match(/\[MODEL:(.*?)\]/))) {
        rawBuffer.current = rawBuffer.current.replace(/\[MODEL:.*?\]/, `{|MOD:${modMatch[1].trim().toLowerCase()}|}`);
    }
    
    // Check for ANIMATE tag
    let animMatch;
    while ((animMatch = rawBuffer.current.match(/\[ANIMATE:\s*({.*?})\s*\]/))) {
        rawBuffer.current = rawBuffer.current.replace(/\[ANIMATE:.*?\]/, `{|ANI:${animMatch[1]}|}`);
    }
    
    // Check for NONE tag
    while (rawBuffer.current.includes('[NONE]')) {
        rawBuffer.current = rawBuffer.current.replace(/\[NONE\]/g, `{|NON|}`);
    }

    // Determine safe text to speak (avoiding partially streamed tags)
    const openBracketIndex = rawBuffer.current.lastIndexOf('[');
    let safeText = '';
    
    if (openBracketIndex !== -1) {
        safeText = rawBuffer.current.substring(0, openBracketIndex);
        rawBuffer.current = rawBuffer.current.substring(openBracketIndex);
    } else {
        safeText = rawBuffer.current;
        rawBuffer.current = '';
    }

    if (safeText) {
        remainingStreamText.current += safeText;
        currentSentence.current += safeText;

        // Split by sentence boundaries to speak in natural chunks
        if (currentSentence.current.match(/[.!?]\s/)) {
            const sentence = currentSentence.current;
            currentSentence.current = '';
            utteranceQueue.current.push(sentence);
            // Intentionally not calling processQueue() here so we wait until stream is fully done!
        }
    }
  };

  const processQueue = () => {
    if (isSpeaking.current || utteranceQueue.current.length === 0) return;
    
    isSpeaking.current = true;
    setStatus('explaining');
    let textToSpeak = utteranceQueue.current.shift() || '';
    
    // Check for embedded tags to sync visually with voice
    const vidMatch = textToSpeak.match(/\{\|VID:(.*?)\|\}/);
    if (vidMatch) {
        setVideoUrl(`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(vidMatch[1])}&autoplay=1&mute=1`);
        setImageUrl(null);
        setModelName(null);
    }
    
    const modMatch = textToSpeak.match(/\{\|MOD:(.*?)\|\}/);
    if (modMatch) {
        setModelName(modMatch[1]);
        setImageUrl(null);
        setVideoUrl(null);
    }
    
    const aniMatch = textToSpeak.match(/\{\|ANI:(.*?)\|\}/);
    if (aniMatch) {
        try { useStore.getState().setAnimationData(JSON.parse(aniMatch[1])); } catch(e){}
    }
    
    const nonMatch = textToSpeak.match(/\{\|NON\|\}/);
    if (nonMatch) {
        setImageUrl(null);
        setVideoUrl(null);
        setModelName(null);
    }

    const imgMatch = textToSpeak.match(/\{\|IMG:(.*?)\|\}/);
    
    // Clean all tags from spoken text
    textToSpeak = textToSpeak.replace(/\{\|.*?\|\}/g, '');

    if (imgMatch) {
        const term = imgMatch[1];
        setVideoUrl(null);
        setModelName(null);
        
        const cachedUrl = imageCache.current[term];
        if (cachedUrl) {
            setImageUrl(cachedUrl);
            setTimeout(() => speakUtterance(textToSpeak), 800);
            return;
        } else {
            fetchWikimediaImage(term).then(url => {
                if (url) setImageUrl(url);
                setTimeout(() => speakUtterance(textToSpeak), url ? 800 : 0);
            });
            return;
        }
    }
    
    speakUtterance(textToSpeak);
  };

  const speakUtterance = (textToSpeak: string) => {
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
                    const resumePhrase = " Returning to the previous topic... ";
                    // Safely push to rawBuffer to allow chunking again instead of forcing a massive utterance
                    rawBuffer.current = resumePhrase + ctx.textRemaining;
                    processChunk('');
                } else {
                    if (!isMutedRef.current) setStatus('listening');
                    setSubtitle('');
                }
            }
        }
    };
    
    synth.speak(utterance);
  };

  const fetchWikimediaImage = async (query: string): Promise<string | null> => {
    try {
        const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&format=json&origin=*`;
        const res = await fetch(searchUrl);
        const data = await res.json();
        const pages = data.query?.pages;
        
        if (pages) {
            const pageId = Object.keys(pages)[0];
            if (pages[pageId] && pages[pageId].imageinfo && pages[pageId].imageinfo[0]) {
                const url = pages[pageId].imageinfo[0].url;
                // Pre-download image bytes into browser memory instantly
                const img = new Image();
                img.src = url;
                return url;
            }
        }
        console.log(`No Wikimedia Commons image found for ${query}`);
        return null;
    } catch(e) {
        console.error(`Error fetching image for ${query}`, e);
        return null;
    }
  };

  const startListening = () => {
    if (isMutedRef.current) return;
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
          className={`mic-button ${status === 'listening' && !isMuted ? 'listening' : ''} ${status === 'thinking' ? 'thinking' : ''} ${isMuted ? 'muted' : ''}`}
          onClick={toggleMute}
          title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          style={{ backgroundColor: isMuted ? '#ff3366' : '' }}
        >
          {status === 'thinking' ? <Loader className="animate-spin" /> : isMuted ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          ) : (
            <Mic />
          )}
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
