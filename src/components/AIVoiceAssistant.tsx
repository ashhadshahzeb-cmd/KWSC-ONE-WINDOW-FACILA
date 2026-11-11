import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, Sparkles, X, User, Key, Settings, Check, ExternalLink, Send } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";

// Gentle audio chimes for voice feedback
const playChime = (type: 'listen' | 'reply') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'listen') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } else if (type === 'reply') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    }
  } catch (e) {}
};

export const AIVoiceAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [typedInput, setTypedInput] = useState("");

  const [geminiKey, setGeminiKey] = useState<string>(() => {
    return localStorage.getItem("kwsc_gemini_api_key") || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
  });
  const [tempKeyInput, setTempKeyInput] = useState(geminiKey);

  // Default to Arshad bhai so user is never stuck in a name verification loop
  const [userName, setUserName] = useState<string>(() => {
    const saved = localStorage.getItem("kwsc_voice_user_name");
    if (saved) return saved;
    localStorage.setItem("kwsc_voice_user_name", "Arshad");
    return "Arshad";
  });

  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("Assalamu Alaykum Arshad bhai! Main KWSC ka Gemini AI Assistant hoon. Main aapki kya madad karoon?");

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userNameRef = useRef(userName);
  const isMountedRef = useRef(true);

  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  // Clean, high clarity speech playback
  const speakVoice = (text: string) => {
    setIsSpeaking(true);
    playChime('reply');

    // Pause recognition while speaking to avoid hearing own voice
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ur&client=tw-ob`;
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        // Resume listening automatically after speaking
        if (isMountedRef.current && isOpen) {
          startListening();
        }
      };

      audio.onerror = () => {
        fallbackBrowserSpeech(text);
      };

      audio.play().catch(() => {
        fallbackBrowserSpeech(text);
      });
    } catch (e) {
      fallbackBrowserSpeech(text);
    }
  };

  const fallbackBrowserSpeech = (text: string) => {
    if (!('speechSynthesis' in window)) {
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => v.lang.startsWith('ur') || v.lang.startsWith('hi') || v.name.includes('Natural'));
    if (naturalVoice) utterance.voice = naturalVoice;
    utterance.rate = 0.95;
    utterance.onend = () => {
      setIsSpeaking(false);
      if (isMountedRef.current && isOpen) startListening();
    };
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Build live database context
  const gatherDatabaseContext = async (query: string) => {
    let summary = "";
    try {
      const allRecords = await db.records.toArray();
      const totalCount = allRecords.length;

      const pensionCount = allRecords.filter(r => (r.main_category || "").toLowerCase().includes("pension") || (r.subject || "").toLowerCase().includes("pension")).length;
      const medicalCount = allRecords.filter(r => (r.main_category || "").toLowerCase().includes("medical")).length;
      const contingencyCount = allRecords.filter(r => (r.main_category || "").toLowerCase().includes("contingency")).length;

      summary += `Current Database Statistics:\n- Total registered files: ${totalCount}\n- Pension files count: ${pensionCount}\n- Medical files count: ${medicalCount}\n- Contingency files count: ${contingencyCount}\n\n`;

      const qLower = query.toLowerCase();
      const matched = allRecords.filter(r => 
        (r.party_name && qLower.includes(r.party_name.toLowerCase())) ||
        (r.cfo_diary_number && qLower.includes(r.cfo_diary_number.toLowerCase())) ||
        (r.receiving_number && qLower.includes(r.receiving_number.toLowerCase())) ||
        (r.subject && qLower.includes(r.subject.toLowerCase()))
      ).slice(0, 5);

      if (matched.length > 0) {
        summary += `Matched Records in Database:\n`;
        matched.forEach((m, idx) => {
          summary += `${idx + 1}. Party: ${m.party_name || 'N/A'}, Diary: ${m.cfo_diary_number}, Receiving: ${m.receiving_number}, Current Section: ${m.mark_to || 'CFO Office'}, Inward Date: ${m.inward_date || 'N/A'}, Subject: ${m.subject || 'N/A'}\n`;
        });
      }
    } catch (e) {
      console.error("Gather context error:", e);
    }
    return summary;
  };

  // Process query through Gemini or intelligent local database lookup
  const processQuery = async (userQuery: string) => {
    const raw = userQuery.trim();
    if (!raw) return;

    setTranscript(raw);
    setIsLoadingAi(true);

    const currentName = userNameRef.current || "Arshad";
    const activeKey = geminiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY;

    // Check if user has Gemini Key configured
    if (activeKey) {
      try {
        const genAI = new GoogleGenerativeAI(activeKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const dbContext = await gatherDatabaseContext(raw);

        const prompt = `
You are the official conversational AI Voice Assistant for KWSC (Karachi Water & Sewerage Corporation).
The user speaking with you is: "${currentName} bhai".

Real-time KWSC Database Context:
${dbContext}

User's request:
"${raw}"

Instructions:
1. Speak in warm, respectful, fluent natural Pakistani Urdu (or Roman Urdu).
2. Always address the user warmly as "${currentName} bhai".
3. Answer directly and specifically based on the database statistics and records provided.
4. Keep the answer to 1 or 2 concise, clear spoken sentences without bullet points, emojis, or symbols.
5. Sound like an intelligent, helpful human colleague.
`;

        const result = await model.generateContent(prompt);
        const reply = result.response.text().trim();
        setAiResponse(reply);
        speakVoice(reply);
        setIsLoadingAi(false);
        return;
      } catch (err) {
        console.error("Gemini failed, using instant local lookup:", err);
      }
    }

    // Instant local database intelligence fallback (no API key required!)
    try {
      const lower = raw.toLowerCase();
      const allRecords = await db.records.toArray();

      if (lower.includes("pension") || lower.includes("پنشن")) {
        const pCount = allRecords.filter(r => (r.main_category || "").toLowerCase().includes("pension") || (r.subject || "").toLowerCase().includes("pension")).length;
        const reply = `${currentName} bhai, Pension section mein is waqt kul ${pCount} files mojood hain.`;
        setAiResponse(reply);
        speakVoice(reply);
        setIsLoadingAi(false);
        return;
      }

      if (lower.includes("total") || lower.includes("kitni file") || lower.includes("kul file") || lower.includes("تمام فائلیں")) {
        const tCount = allRecords.length;
        const reply = `${currentName} bhai, KWSC system mein is waqt total ${tCount} files darj hain.`;
        setAiResponse(reply);
        speakVoice(reply);
        setIsLoadingAi(false);
        return;
      }

      // Check for specific party or file name
      const cleanWord = lower.replace(/(file|kahan hai|dikhao|status|batao|kahan gayi|kab aayi|details)/gi, '').trim();
      if (cleanWord.length >= 2) {
        const found = allRecords.find(r => 
          (r.party_name && r.party_name.toLowerCase().includes(cleanWord)) ||
          (r.subject && r.subject.toLowerCase().includes(cleanWord)) ||
          (r.cfo_diary_number && r.cfo_diary_number.toLowerCase().includes(cleanWord)) ||
          (r.receiving_number && r.receiving_number.toLowerCase().includes(cleanWord))
        );

        if (found) {
          const sec = found.mark_to || "CFO Office";
          const diary = found.cfo_diary_number || found.receiving_number || "—";
          const party = found.party_name || found.subject || "File";
          const reply = `${currentName} bhai, ${party} ki file mil gayi hai. Yeh is waqt ${sec} section mein hai, aur Diary number ${diary} hai.`;
          setAiResponse(reply);
          speakVoice(reply);
          setIsLoadingAi(false);
          return;
        }
      }

      // Friendly default reply
      const reply = `${currentName} bhai, main files ki tadad ya kisi specific file ka status bata sakta hoon. Aap pooch sakte hain: Pension mein kitni files hain? Ya kisi file ka naam batayein.`;
      setAiResponse(reply);
      speakVoice(reply);
    } catch (e) {
      const errReply = `${currentName} bhai, database se rabta karne mein waqti masla aaya. Barah-e-karam dobara poochein.`;
      setAiResponse(errReply);
      speakVoice(errReply);
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Start Voice Recognition with real-time feedback
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Single utterance mode prevents frozen audio streams
      recognition.interimResults = true; // Show words in real-time as user speaks
      recognition.lang = "ur-PK";

      recognition.onstart = () => {
        setIsListening(true);
        playChime('listen');
      };

      recognition.onresult = (event: any) => {
        let interimText = "";
        let isFinal = false;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          interimText += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            isFinal = true;
          }
        }

        setTranscript(interimText);

        if (isFinal && interimText.trim()) {
          setIsListening(false);
          processQuery(interimText);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech error:", e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  const stopListening = () => {
    setIsListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }
    if (audioRef.current) audioRef.current.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const toggleAssistant = () => {
    if (!isOpen) {
      setIsOpen(true);
      // Greet Arshad bhai directly without annoying name blockers!
      startListening();
    } else {
      stopListening();
      setIsOpen(false);
    }
  };

  const saveApiKey = () => {
    setGeminiKey(tempKeyInput.trim());
    localStorage.setItem("kwsc_gemini_api_key", tempKeyInput.trim());
    setShowSettings(false);
    const msg = `Arshad bhai, Gemini API key save ho gayi hai. Ab aap mujh se koi bhi sawaal pooch sakte hain!`;
    setAiResponse(msg);
    speakVoice(msg);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (recognitionRef.current) try { recognitionRef.current.abort(); } catch (e) {}
      if (audioRef.current) audioRef.current.pause();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 select-none">
        <button
          onClick={toggleAssistant}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-full font-black text-xs shadow-2xl transition-all duration-300 border-2 ${
            isOpen
              ? "bg-[#1e3a8a] text-white border-blue-400 scale-105 shadow-blue-500/30"
              : "bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-[#1e3a8a]/40 hover:border-[#1e3a8a] hover:scale-105"
          }`}
          title="KWSC AI Voice Assistant"
        >
          <div className="relative">
            <Sparkles className={`w-4 h-4 ${isOpen ? "text-amber-300 animate-spin" : "text-[#1e3a8a] dark:text-sky-400"}`} />
            {isListening && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
          <span className="tracking-wide uppercase font-extrabold">
            {isOpen ? (isListening ? "Listening..." : "KWSC AI") : "AI Voice"}
          </span>
          {isSpeaking && (
            <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* Expanded Interactive Voice Canvas */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border-2 border-[#1e3a8a] dark:border-sky-400 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-6 duration-200">
          
          {/* Header */}
          <div className="bg-[#1e3a8a] text-white px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider">KWSC Voice Assistant</h3>
                <p className="text-[10px] text-blue-100/70 font-mono">Arshad Bhai Personal AI</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1.5 rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all"
                title="Gemini API Key"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  if (isListening) stopListening();
                  else startListening();
                }}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  isListening ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/40" : "bg-white/10 text-white/70 hover:text-white"
                }`}
                title={isListening ? "Stop Microphone" : "Speak Now"}
              >
                {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Settings Panel for Gemini Key */}
          {showSettings && (
            <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#1e3a8a] dark:text-sky-400" /> Gemini API Key (Optional)
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  Free Key <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Paste Gemini API Key..."
                  value={tempKeyInput}
                  onChange={(e) => setTempKeyInput(e.target.value)}
                  className="flex-1 h-9 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
                <button
                  onClick={saveApiKey}
                  className="px-3 bg-[#1e3a8a] hover:bg-blue-900 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
              </div>
            </div>
          )}

          {/* Active User Indicator */}
          <div className="px-5 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
              <User className="w-3.5 h-3.5 text-[#1e3a8a] dark:text-sky-400" />
              <span>
                Assalamu Alaykum, <span className="text-[#1e3a8a] dark:text-sky-400 font-extrabold">{userName} Bhai</span>
              </span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Ready
            </span>
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-4 max-h-[380px] overflow-y-auto">
            
            {/* Listening Orb & Mic Tap Button */}
            <div className="flex flex-col items-center justify-center py-2 text-center">
              <button
                onClick={() => {
                  if (isListening) stopListening();
                  else startListening();
                }}
                className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ${
                  isListening 
                    ? "bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-xl shadow-emerald-500/40 scale-110" 
                    : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                }`}
                title={isListening ? "Listening... Tap to stop" : "Tap to Speak"}
              >
                {isListening ? (
                  <Mic className="w-7 h-7 text-white animate-pulse" />
                ) : (
                  <Mic className="w-7 h-7 text-[#1e3a8a] dark:text-sky-400" />
                )}
                {isSpeaking && (
                  <span className="absolute inset-0 rounded-full border-4 border-amber-400 animate-ping pointer-events-none" />
                )}
              </button>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mt-2 font-mono">
                {isListening ? "Listening... (Aap Bolain)" : "Mic band hai — button daba kar bolain"}
              </p>
            </div>

            {/* Live Heard Transcript */}
            {transcript && (
              <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a] dark:text-sky-400 block mb-1">
                  Aap Ne Farmaya:
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  "{transcript}"
                </p>
              </div>
            )}

            {/* AI Spoken Answer */}
            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Assistant:
                </span>
                {isLoadingAi ? (
                  <span className="text-[9px] font-black text-blue-500 animate-pulse">Checking records...</span>
                ) : isSpeaking ? (
                  <span className="text-[9px] font-black text-amber-500 animate-pulse">Bol raha hai...</span>
                ) : null}
              </div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-100 leading-relaxed">
                {aiResponse}
              </p>
            </div>

            {/* Quick Prompts */}
            <div className="pt-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                Quick Test Sawaal:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Pension me kitni files hain?",
                  "Total kitni files hain?",
                  "Mughal Petroleum ki file kahan hai?"
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => processQuery(sample)}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-200/60 dark:bg-slate-800 hover:bg-[#1e3a8a] hover:text-white transition-all text-slate-700 dark:text-slate-300 text-left"
                  >
                    "{sample}"
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Text Input Fallback */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (typedInput.trim()) {
                    processQuery(typedInput);
                    setTypedInput("");
                  }
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  placeholder="Bolain ya yahan likh kar poochain..."
                  value={typedInput}
                  onChange={(e) => setTypedInput(e.target.value)}
                  className="flex-1 h-9 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  className="px-3 bg-[#1e3a8a] hover:bg-blue-900 text-white rounded-xl transition-all flex items-center justify-center"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default AIVoiceAssistant;
