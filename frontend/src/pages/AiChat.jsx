import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, Bot, User, Sparkles, ChevronRight, ImageIcon, Trash2, Clock } from 'lucide-react';
import AprisChickenIcon from '../components/ui/AprisChickenIcon';
import { aiChatStream, aiClearSession } from '../services/api.js';
import { useFarmContext } from '../context/FarmContext.jsx';

// ── localStorage persistence ──────────────────────────────────────────────────
const STORAGE_KEY   = 'apris_ai_chat';
const SESSION_KEY   = 'apris_ai_session_id';
const TTL_MS        = 24 * 60 * 60 * 1000; // 24 hours

function loadStoredChat() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { messages, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    // Strip any messages that were mid-stream when the user left
    const clean = messages.map((m) => ({ ...m, streaming: false }));
    return { messages: clean, savedAt };
  } catch {
    return null;
  }
}

function saveChat(messages, savedAt) {
  try {
    // Don't persist image blob URLs — they become invalid after page reload
    const stripped = messages.map((m) => ({ ...m, images: [] }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: stripped, savedAt }));
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

function clearStoredChat() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_KEY);
}

function formatExpiry(savedAt) {
  const expiresAt = savedAt + TTL_MS;
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return null;
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Suggested prompts ─────────────────────────────────────────────────────────
const SUGGESTED_PROMPTS = [
  { icon: '🐔', text: 'My chickens seem lethargic and not eating. What could be wrong?' },
  { icon: '💊', text: 'What vaccinations does a 4-week-old broiler flock need?' },
  { icon: '🌡️', text: 'Ideal temperature and humidity range for layers in dry season?' },
  { icon: '🦠', text: 'How do I prevent Newcastle Disease from spreading in my farm?' },
  { icon: '🥚', text: 'My egg production dropped by 30% this week. What are possible causes?' },
  { icon: '🧴', text: 'Best biosecurity practices after an outbreak in a nearby farm?' },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 max-w-[80%]">
      <div className="w-8 h-8 rounded-full bg-[#2E7D52] flex items-center justify-center flex-shrink-0 shadow-sm">
        <AprisChickenIcon size={14} />
      </div>
      <div className="bg-white border border-[#E5E7EB] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5 h-5">
          <span className="w-2 h-2 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? 'flex-row-reverse ml-auto max-w-[80%]' : 'max-w-[80%]'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
        isUser ? 'bg-[#1A2332]' : 'bg-[#2E7D52]'
      }`}>
        {isUser ? <User size={14} className="text-white" /> : <AprisChickenIcon size={14} />}
      </div>

      <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        {message.images?.length > 0 && (
          <div className={`flex flex-wrap gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {message.images.map((img, i) => (
              <div key={i} className="relative w-40 h-40 rounded-xl overflow-hidden border border-[#E5E7EB] shadow-sm bg-gray-100">
                <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {(message.text || message.streaming) && (
          <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-[#1A2332] text-white rounded-br-sm'
              : 'bg-white border border-[#E5E7EB] text-[#1A2332] rounded-bl-sm'
          }`}>
            {message.text}
            {message.streaming && (
              <span className="inline-block w-0.5 h-4 bg-[#2E7D52] ml-0.5 align-middle animate-pulse" />
            )}
          </div>
        )}

        <span className="text-[10px] text-[#9CA3AF] px-1">
          {new Date(message.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AiChat() {
  const { selectedFarm } = useFarmContext();

  // Restore from localStorage on first render
  const stored = loadStoredChat();
  const [messages, setMessages] = useState(stored?.messages ?? []);
  const [savedAt,  setSavedAt]  = useState(stored?.savedAt  ?? null);
  const [expiry,   setExpiry]   = useState(() => stored ? formatExpiry(stored.savedAt) : null);

  const [input,    setInput]    = useState('');
  const [images,   setImages]   = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const fileInputRef = useRef(null);
  const abortRef     = useRef(null);

  // Restore or generate a stable session ID
  const sessionIdRef = useRef(
    localStorage.getItem(SESSION_KEY) || (() => {
      const id = `chat-${Date.now()}`;
      localStorage.setItem(SESSION_KEY, id);
      return id;
    })()
  );

  // Persist messages to localStorage whenever they change (skip streaming frames)
  useEffect(() => {
    const hasStreaming = messages.some((m) => m.streaming);
    if (hasStreaming) return; // wait until stream finishes before saving
    if (messages.length === 0) return;
    const ts = savedAt ?? Date.now();
    if (!savedAt) setSavedAt(ts);
    saveChat(messages, ts);
    setExpiry(formatExpiry(ts));
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh the expiry countdown every minute
  useEffect(() => {
    if (!savedAt) return;
    const interval = setInterval(() => {
      const label = formatExpiry(savedAt);
      if (!label) {
        // Expired — wipe everything
        clearStoredChat();
        setMessages([]);
        setSavedAt(null);
        setExpiry(null);
      } else {
        setExpiry(label);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [savedAt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = files
      .filter((f) => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024)
      .slice(0, 4 - images.length);
    setImages((prev) => [
      ...prev,
      ...valid.map((f) => ({ file: f, preview: URL.createObjectURL(f), name: f.name })),
    ]);
    e.target.value = '';
  };

  const removeImage = (index) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const sendMessage = useCallback((text = input.trim(), imgs = images) => {
    if (!text && imgs.length === 0) return;
    if (isTyping) return;

    const now = Date.now();
    const assistantMsgId = now + 1;

    setMessages((prev) => [
      ...prev,
      { id: now,            role: 'user',      text, images: imgs, ts: new Date().toISOString() },
      { id: assistantMsgId, role: 'assistant', text: '', ts: new Date().toISOString(), streaming: true },
    ]);
    setInput('');
    setImages([]);
    setIsTyping(true);

    abortRef.current?.abort();

    abortRef.current = aiChatStream({
      message: text,
      sessionId: sessionIdRef.current,
      farmId: selectedFarm?.id || null,
      onDelta: (delta) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsgId ? { ...m, text: m.text + delta } : m)
        );
      },
      onDone: () => {
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsgId ? { ...m, streaming: false } : m)
        );
      },
      onError: (err) => {
        console.error('AI chat error:', err);
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, text: 'Sorry, I encountered an error. Please try again.', streaming: false }
              : m
          )
        );
      },
    });
  }, [input, images, isTyping, selectedFarm]);

  const clearConversation = async () => {
    abortRef.current?.abort();
    await aiClearSession({ sessionId: sessionIdRef.current }).catch(() => {});
    // Generate a fresh session ID and persist it
    const newId = `chat-${Date.now()}`;
    sessionIdRef.current = newId;
    localStorage.setItem(SESSION_KEY, newId);
    clearStoredChat();
    setMessages([]);
    setSavedAt(null);
    setExpiry(null);
    setIsTyping(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header banner */}
      <div
        className="rounded-2xl p-5 sm:p-6 flex items-center gap-4 flex-shrink-0 mb-4"
        style={{ background: 'linear-gradient(135deg, #1A2332 0%, #243447 100%)' }}
      >
        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <Sparkles size={22} color="white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white">APRIS AI Assistant</h2>
          {selectedFarm ? (
            <p className="text-[#94A3B8] text-sm">
              Context: <span className="text-[#4ADE80] font-medium">{selectedFarm.name}</span>
              {' '}— Ask about diseases, nutrition, biosecurity, and more
            </p>
          ) : (
            <p className="text-[#94A3B8] text-sm">
              Ask anything about your flock — diseases, nutrition, biosecurity, and more
            </p>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={clearConversation}
              className="flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
              title="Clear conversation"
            >
              <Trash2 size={13} />
              Clear
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-[#2E7D52]/30 border border-[#2E7D52]/50 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
            <span className="text-[#4ADE80] text-xs font-medium">Online</span>
          </div>
        </div>
      </div>

      {/* Persistence indicator — shown only when there are saved messages */}
      {messages.length > 0 && expiry && (
        <div className="flex items-center gap-2 px-1 mb-3 flex-shrink-0">
          <Clock size={12} className="text-[#9CA3AF]" />
          <span className="text-[11px] text-[#9CA3AF]">
            Chat saved · history expires in <span className="font-medium text-[#6B7280]">{expiry}</span>
          </span>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full pb-6 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#E8F5EE] flex items-center justify-center mb-4">
              <Bot size={32} className="text-[#2E7D52]" />
            </div>
            <h3 className="text-lg font-bold text-[#1A2332] mb-1">How can I help you today?</h3>
            <p className="text-[#6B7280] text-sm mb-8 max-w-sm">
              Ask me anything about poultry farming, disease management, or flock health.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-2xl">
              {SUGGESTED_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p.text, [])}
                  className="flex items-center gap-3 text-left px-4 py-3 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#2E7D52] hover:bg-[#F0FAF4] transition-all group shadow-sm"
                >
                  <span className="text-xl flex-shrink-0">{p.icon}</span>
                  <span className="text-sm text-[#374151] group-hover:text-[#1A2332] flex-1 leading-snug">{p.text}</span>
                  <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#2E7D52] flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5 px-2 pb-4 pt-2">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isTyping && !messages.find((m) => m.streaming) && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 pt-3">
        {images.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap px-1">
            {images.map((img, i) => (
              <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#E5E7EB] shadow-sm bg-gray-100 flex-shrink-0">
                <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X size={10} color="white" />
                </button>
              </div>
            ))}
            {images.length < 4 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-[#D1D5DB] flex items-center justify-center hover:border-[#2E7D52] hover:bg-[#F0FAF4] transition-all flex-shrink-0"
              >
                <ImageIcon size={18} className="text-[#9CA3AF]" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-end gap-2 bg-white border border-[#E5E7EB] rounded-2xl shadow-sm px-3 py-2.5 focus-within:border-[#2E7D52] focus-within:ring-2 focus-within:ring-[#2E7D52]/10 transition-all">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={images.length >= 4}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#2E7D52] hover:bg-[#F0FAF4] transition-all disabled:opacity-40 disabled:cursor-not-allowed mb-0.5"
            title="Attach image (max 4)"
          >
            <Paperclip size={18} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageSelect}
          />

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about disease symptoms, treatment, biosecurity…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-[#1A2332] placeholder-[#9CA3AF] outline-none leading-relaxed py-1 max-h-36 overflow-y-auto"
          />

          <button
            onClick={() => sendMessage()}
            disabled={(!input.trim() && images.length === 0) || isTyping}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all mb-0.5
              bg-[#2E7D52] text-white hover:bg-[#245F40] shadow-sm
              disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] disabled:shadow-none disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-[#D1D5DB] text-center mt-2">
          AI responses are advisory only. Always consult a qualified vet for medical decisions.
        </p>
      </div>
    </div>
  );
}
