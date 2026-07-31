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
  
  // Streaming state
  const utteranceQueue = useRef<string[]>([]);
  const isSpeaking = useRef(false);
  const currentSentence = useRef('');
  const remainingStreamText = useRef(''); // For interruption
  const rawBuffer = useRef(''); // For tag parsing

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
        const url = `http://localhost:3001/api/chat/stream?message=${encodeURIComponent(query)}`;
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            if (event.data === '[DONE]') {
                eventSource.close();
                
                // Flush anything left in the rawBuffer as a sentence if it exists and has no unclosed tags
                if (rawBuffer.current && !rawBuffer.current.includes('[')) {
                    currentSentence.current += rawBuffer.current;
                    rawBuffer.current = '';
                    if (currentSentence.current.trim() !== '') {
                        utteranceQueue.current.push(currentSentence.current);
                        currentSentence.current = '';
                        processQueue();
                    }
                }
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
        fetchWikipediaImage(imgMatch[1].trim());
        rawBuffer.current = rawBuffer.current.replace(/\[IMAGE:.*?\]/, '');
    }

    // Check for Video tag
    let vidMatch;
    while ((vidMatch = rawBuffer.current.match(/\[VIDEO:(.*?)\]/))) {
        setVideoUrl(`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(vidMatch[1].trim())}&autoplay=1&mute=1`);
        rawBuffer.current = rawBuffer.current.replace(/\[VIDEO:.*?\]/, '');
    }

    // Check for Model tag
    let modMatch;
    while ((modMatch = rawBuffer.current.match(/\[MODEL:(.*?)\]/))) {
        setModelName(modMatch[1].trim().toLowerCase());
        rawBuffer.current = rawBuffer.current.replace(/\[MODEL:.*?\]/, '');
    }
    
    // Check for ANIMATE tag
    let animMatch;
    while ((animMatch = rawBuffer.current.match(/\[ANIMATE:\s*({.*?})\s*\]/))) {
        try {
            const animData = JSON.parse(animMatch[1]);
            useStore.getState().setAnimationData(animData);
        } catch(e) {
            console.error("Failed to parse animation json");
        }
        rawBuffer.current = rawBuffer.current.replace(/\[ANIMATE:.*?\]/, '');
    }
    
    // Check for NONE tag
    while (rawBuffer.current.includes('[NONE]')) {
        rawBuffer.current = rawBuffer.current.replace(/\[NONE\]/g, '');
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
            processQueue();
        }
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
        // Step 1: OpenSearch to get the exact Wikipedia article title
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json&origin=*`;
        const searchRes = await axios.get(searchUrl);
        
        if (searchRes.data[1] && searchRes.data[1].length > 0) {
            const actualTitle = searchRes.data[1][0];
            
            // Step 2: Fetch the high-res image for that exact title
            const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${encodeURIComponent(actualTitle)}&origin=*`;
            const imgRes = await axios.get(imgUrl);
            const pages = imgRes.data.query.pages;
            const pageId = Object.keys(pages)[0];
            
            if (pages[pageId] && pages[pageId].original) {
                setImageUrl(pages[pageId].original.source);
            } else {
                console.log(`No image found on page for ${actualTitle}`);
            }
        } else {
            console.log(`No Wikipedia article found for ${query}`);
        }
    } catch(e) {
        console.error(`Error fetching image for ${query}`, e);
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
