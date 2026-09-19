import { useState } from "react";
import { Bot, X, Send } from "lucide-react";
import { sendChatMessage } from "../lib/ai.ts";

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    { sender: "ai", text: "⚡ Hi! I'm EcoPulse AI. Ask me where to find fast chargers or low wait times in Pune!" }
  ]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setLoading(true);

    const aiReply = await sendChatMessage({ message: userMsg });
    setMessages((prev) => [...prev, { sender: "ai", text: aiReply }]);
    setLoading(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-full shadow-xl transition-transform hover:scale-105"
        >
          <Bot className="w-6 h-6" />
          <span>AI Assistant</span>
        </button>
      )}

      {isOpen && (
        <div className="w-80 sm:w-96 bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl flex flex-col h-[450px] overflow-hidden">
          <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              <span className="font-bold text-sm">EcoPulse AI Grid Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    msg.sender === "user"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800 text-slate-200 border border-slate-700"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-xs text-slate-400 animate-pulse flex items-center gap-1">
                <Bot className="w-4 h-4 text-emerald-400" /> AI is analyzing grid data...
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-900 border-t border-slate-700 flex gap-2">
            <input
              type="text"
              placeholder="Ask about charging slots..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white p-2 rounded-lg"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}