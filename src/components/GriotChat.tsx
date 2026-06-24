import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Quote, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { chatWithGriot, generateSpeech } from '../services/geminiService';
import { Media } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export default function GriotChat() {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<number | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'media'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mediaData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Media[];
      setMedia(mediaData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const transcripts = media.map(m => `Title: ${m.title}\nTranscript: ${m.transcript}`);
      const response = await chatWithGriot(userMessage, transcripts);
      setMessages(prev => [...prev, { role: 'bot', content: response || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'bot', content: "Forgive me, but I am having trouble accessing the archive right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const [isSpeechLoading, setIsSpeechLoading] = useState<number | null>(null);

  const handleSpeak = async (index: number, text: string) => {
    if (isSpeaking === index) {
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch (e) {
          // Ignore if already stopped
        }
        audioSourceRef.current = null;
      }
      setIsSpeaking(null);
      return;
    }

    // Stop any current audio
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }

    setIsSpeechLoading(index);
    try {
      const base64Audio = await generateSpeech(text);
      if (base64Audio) {
        console.log("Attempting to play audio...");
        
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const audioContext = audioContextRef.current;
        
        // Resume context if it was suspended (common browser policy)
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Int16Array(len / 2);
        for (let i = 0; i < len; i += 2) {
          bytes[i / 2] = (binaryString.charCodeAt(i + 1) << 8) | binaryString.charCodeAt(i);
        }
        
        const audioBuffer = audioContext.createBuffer(1, bytes.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < bytes.length; i++) {
          channelData[i] = bytes[i] / 32768.0;
        }
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => {
          setIsSpeaking(null);
          audioSourceRef.current = null;
        };
        setIsSpeaking(index);
        setIsSpeechLoading(null);
        source.start();
        audioSourceRef.current = source;
      } else {
        console.warn("No audio data to play");
        setIsSpeaking(null);
        setIsSpeechLoading(null);
      }
    } catch (error) {
      console.error("Speech generation or playback failed:", error);
      setIsSpeaking(null);
      setIsSpeechLoading(null);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
      <header className="p-6 border-b border-black/5 bg-[#1A1A1A] text-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F27D26] flex items-center justify-center">
            <Bot size={24} />
          </div>
          <div>
            <h3 className="font-serif italic font-bold text-lg">The Griot</h3>
            <p className="text-xs text-white/60 uppercase tracking-widest font-mono">Cultural Repository Active</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{media.length} Histories Loaded</span>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#F5F2ED]/30"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
            <div className="w-20 h-20 bg-[#F27D26]/10 text-[#F27D26] rounded-full flex items-center justify-center">
              <Quote size={40} />
            </div>
            <div>
              <h4 className="text-2xl font-serif italic font-bold mb-2">Greetings, seeker of knowledge.</h4>
              <p className="text-black/60 leading-relaxed">
                I am the Griot. I hold the stories of our people within me. What would you like to know from our shared history?
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full">
              {['Who are the key figures mentioned?', 'What events shaped this community?', 'Tell me about the movements for change.'].map(q => (
                <button 
                  key={q}
                  onClick={() => setInput(q)}
                  className="p-3 bg-white border border-black/5 rounded-xl text-sm hover:border-[#F27D26] hover:text-[#F27D26] transition-all text-left"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-4 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${
                msg.role === 'user' ? 'bg-[#1A1A1A] text-white' : 'bg-[#F27D26] text-white'
              }`}>
                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
              </div>
              <div className="flex flex-col gap-2">
                <div className={`p-5 rounded-3xl shadow-sm relative group ${
                  msg.role === 'user' ? 'bg-[#1A1A1A] text-white rounded-tr-none' : 'bg-white text-[#1A1A1A] rounded-tl-none border border-black/5'
                }`}>
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  
                  {msg.role === 'bot' && (
                    <button 
                      onClick={() => handleSpeak(i, msg.content)}
                      disabled={isSpeechLoading !== null && isSpeechLoading !== i}
                      className={`absolute -right-12 top-0 p-2 rounded-full transition-all ${
                        isSpeaking === i 
                        ? 'bg-[#F27D26] text-white' 
                        : isSpeechLoading === i
                        ? 'bg-[#F27D26]/50 text-white cursor-not-allowed'
                        : 'bg-white text-black/20 hover:text-[#F27D26] border border-black/5 opacity-0 group-hover:opacity-100'
                      }`}
                      title={isSpeaking === i ? "Stop speaking" : isSpeechLoading === i ? "Preparing speech..." : "Listen to the Griot"}
                    >
                      {isSpeechLoading === i ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : isSpeaking === i ? (
                        <VolumeX size={16} />
                      ) : (
                        <Volume2 size={16} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-4 max-w-[80%]">
              <div className="w-10 h-10 rounded-xl bg-[#F27D26] text-white flex items-center justify-center">
                <Loader2 size={20} className="animate-spin" />
              </div>
              <div className="p-5 bg-white border border-black/5 rounded-3xl rounded-tl-none shadow-sm italic text-black/40">
                Consulting the ancestors...
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-white border-t border-black/5">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Ask the Griot about the archive..."
            className="w-full pl-6 pr-16 py-4 bg-[#F5F2ED] border-none rounded-2xl focus:ring-2 focus:ring-[#F27D26]/20 outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-3 bg-[#F27D26] text-white rounded-xl hover:bg-[#D96B1F] transition-colors disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
