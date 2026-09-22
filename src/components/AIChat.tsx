import { useState, useEffect } from "react";
import { Bot, X, Send, Sparkles, Zap, Mic, MicOff, Volume2 } from "lucide-react";
import { sendChatMessage } from "../lib/ai.ts";
import { useApp } from "../lib/store";
import { haversineKm, queueLevel, type Station } from "../lib/stations";

const INITIAL_PROMPTS = [
  { icon: "🟢", text: "Which station has zero wait time right now?" },
  { icon: "⚡", text: "Show me fast CCS2 chargers near Baner" },
  { icon: "💰", text: "Where can I get off-peak charging discounts?" },
];

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lang, setLang] = useState<"mr-IN" | "hi-IN" | "en-IN">("mr-IN");

  // Track active suggestions so only the clicked prompt disappears
  const [availablePrompts, setAvailablePrompts] = useState(INITIAL_PROMPTS);

  const { stations, userPos } = useApp();

  // Find nearest station & calculate dynamic grid advice
  const sorted = [...stations].sort((a, b) => {
    if (!userPos) return 0;
    return haversineKm(userPos, a) - haversineKm(userPos, b);
  });

  const nearestStation = sorted[0];
  const isCongested = nearestStation && queueLevel(nearestStation) === "congested";
  const alternativeStation = isCongested
    ? sorted.find((s) => s.id !== nearestStation.id && queueLevel(s) !== "congested")
    : null;

  const timeSaved = isCongested && alternativeStation
    ? Math.max(5, nearestStation.waitMins - alternativeStation.waitMins)
    : 0;

  const initialGreeting = isCongested && alternativeStation
    ? `⚡ Smart Grid Alert: ${nearestStation.name} is congested (${nearestStation.waitMins} min wait). I recommend rerouting to ${alternativeStation.name} to save ~${timeSaved} mins & get an off-peak discount!`
    : nearestStation
    ? `⚡ Hi! I'm EcoPulse AI. Traffic conditions are clear—${nearestStation.name} has low wait times (~${nearestStation.waitMins} mins)! Ask me anything in Marathi, Hindi, or English.`
    : "⚡ Hi! I'm EcoPulse AI. Ask me where to find fast chargers or low wait times in Pune!";

  const [messages, setMessages] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    { sender: "ai", text: initialGreeting }
  ]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length <= 1) {
        return [{ sender: "ai", text: initialGreeting }];
      }
      return prev;
    });
  }, [nearestStation?.id, isCongested]);

  // Voice Output (Text-to-Speech)
  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Voice Input (Speech Recognition)
  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSend(transcript);
    };

    recognition.start();
  };

  // Trigger reroute event to update map & draw route line
  const handleRerouteClick = (station: Station) => {
    window.dispatchEvent(new CustomEvent("reroute-station", { detail: station }));
    handleSend(`Reroute me to ${station.name}`);
  };

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    // Filter out only the clicked prompt
    if (textToSend) {
      setAvailablePrompts((prev) => prev.filter((p) => p.text !== textToSend));
    }

    const userMsg = query.trim();
    if (!textToSend) setInput("");
    
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setLoading(true);

    try {
      const aiReply = await sendChatMessage({ message: userMsg });
      setMessages((prev) => [...prev, { sender: "ai", text: aiReply }]);
      speakText(aiReply);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Sorry, I couldn't connect to the grid server right now." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans flex flex-col items-end gap-2">
      {/* 1. PROACTIVE POP-UP BADGE */}
      {!isOpen && isCongested && nearestStation && alternativeStation && (
        <div
          onClick={() => {
            setIsOpen(true);
            handleRerouteClick(alternativeStation);
          }}
          className="max-w-xs cursor-pointer animate-bounce rounded-xl border border-emerald-500/50 bg-slate-900/95 p-3 shadow-xl shadow-emerald-500/20 backdrop-blur-md transition-all hover:scale-105"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" /> Smart Grid Alert
          </div>
          <p className="mt-1 text-[11px] text-slate-200">
            <strong className="text-white">{nearestStation.name}</strong> is busy ({nearestStation.waitMins}m wait). Click to reroute to <strong className="text-emerald-300">{alternativeStation.name}</strong>!
          </p>
        </div>
      )}

      {/* 2. FLOATING AI BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-full shadow-xl transition-transform hover:scale-105"
        >
          <Bot className="w-6 h-6" />
          <span>AI Assistant</span>
        </button>
      )}

      {/* 3. CHATBOX WINDOW */}
      {isOpen && (
        <div className="w-80 sm:w-96 bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl flex flex-col h-[540px] overflow-hidden">
          {/* Header */}
          <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              <span className="font-bold text-sm">EcoPulse AI Grid Assistant</span>
            </div>
            <div className="flex items-center gap-2">
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  className="p-1 text-emerald-400 hover:text-white"
                  title="Stop Audio"
                >
                  <Volume2 className="w-5 h-5 animate-pulse" />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.sender === "user"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800 text-slate-200 border border-slate-700"
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-xs text-slate-400 animate-pulse flex items-center gap-1">
                <Bot className="w-4 h-4 text-emerald-400" /> AI is analyzing grid data...
              </div>
            )}
          </div>

          {/* Quick Reroute Button */}
          {isCongested && alternativeStation && (
            <div className="px-3 pt-2 bg-slate-900 border-t border-slate-800">
              <button
                onClick={() => handleRerouteClick(alternativeStation)}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <Zap className="w-3 h-3" /> Reroute to {alternativeStation.name}
              </button>
            </div>
          )}

          {/* QUICK PROMPT CHIPS (Hides only the prompt that was clicked) */}
          {availablePrompts.length > 0 && (
            <div className="px-3 py-2 bg-slate-900 border-t border-slate-800">
              <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1.5">
                Quick Suggestions
              </p>
              <div className="flex flex-col gap-1.5">
                {availablePrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    disabled={loading}
                    onClick={() => handleSend(prompt.text)}
                    className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/60 px-2.5 py-1.5 text-left text-[11px] text-slate-300 hover:border-emerald-500/50 hover:bg-slate-800 hover:text-emerald-300 transition-colors disabled:opacity-50"
                  >
                    <span>{prompt.icon}</span>
                    <span className="truncate">{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* VOICE LANGUAGE SELECTOR */}
          <div className="border-t border-slate-800 bg-slate-950 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Mic Lang:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setLang("mr-IN")}
                className={`px-2 py-0.5 rounded ${
                  lang === "mr-IN" ? "bg-emerald-500 text-white font-medium" : "hover:bg-slate-800"
                }`}
              >
                Marathi
              </button>
              <button
                onClick={() => setLang("hi-IN")}
                className={`px-2 py-0.5 rounded ${
                  lang === "hi-IN" ? "bg-emerald-500 text-white font-medium" : "hover:bg-slate-800"
                }`}
              >
                Hindi
              </button>
              <button
                onClick={() => setLang("en-IN")}
                className={`px-2 py-0.5 rounded ${
                  lang === "en-IN" ? "bg-emerald-500 text-white font-medium" : "hover:bg-slate-800"
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2 items-center">
            <button
              onClick={startListening}
              className={`p-2 rounded-lg transition-colors ${
                isListening
                  ? "bg-red-500/20 text-red-400 border border-red-500/50 animate-bounce"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Click mic to speak"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              type="text"
              placeholder={isListening ? "Listening..." : "Ask in Marathi, Hindi, English..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}