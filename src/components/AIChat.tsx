'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  '¿Qué es la Ley 1581 y a quién aplica?',
  '¿Qué es Privacy by Design?',
  '¿Qué sanciones tiene el incumplimiento?',
  '¿Cómo mejoro mi puntaje en el bloque A?',
];

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll al último mensaje
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Focus al abrir
  useEffect(() => {
    if (open) {
      setUnread(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const send = useCallback(async (text: string) => {
    const userMsg = text.trim();
    if (!userMsg || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      const reply: Message = { role: 'assistant', content: data.content ?? 'Sin respuesta.' };
      setMessages((prev) => [...prev, reply]);
      if (!open) setUnread(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error de conexión. Por favor intenta de nuevo.' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, open]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function reset() {
    setMessages([]);
    setInput('');
  }

  return (
    <>
      {/* ── Panel de chat ─────────────────────────────────────── */}
      <div className={cn(
        'fixed bottom-24 right-6 z-50 w-[360px] max-h-[560px] flex flex-col',
        'bg-white rounded-2xl shadow-2xl border border-gray-200',
        'transition-all duration-300 origin-bottom-right',
        open ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-95 opacity-0 pointer-events-none',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-brand-600 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">Asesor Ley 1581</p>
              <p className="text-xs text-brand-200">Consultas sobre protección de datos</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button onClick={reset}
                className="text-xs text-brand-200 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">
                Limpiar
              </button>
            )}
            <button onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-brand-200 hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 scrollbar-thin">
          {/* Bienvenida */}
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-brand-600" />
                </div>
                <div className="bg-gray-50 rounded-xl rounded-tl-sm px-3.5 py-2.5 text-sm text-gray-700 max-w-[260px]">
                  Hola 👋 Soy tu asesor especializado en la <strong>Ley 1581 de 2012</strong>. Puedo ayudarte con cumplimiento, Privacy by Design, tus resultados de diagnóstico y mucho más.
                </div>
              </div>
              {/* Sugerencias */}
              <div className="pl-9 space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="block w-full text-left text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg px-3 py-1.5 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Historial */}
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex items-start gap-2.5', msg.role === 'user' && 'flex-row-reverse')}>
              {/* Avatar */}
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                msg.role === 'assistant' ? 'bg-brand-100' : 'bg-gray-200',
              )}>
                {msg.role === 'assistant'
                  ? <Bot className="w-4 h-4 text-brand-600" />
                  : <User className="w-4 h-4 text-gray-500" />}
              </div>
              {/* Burbuja */}
              <div className={cn(
                'px-3.5 py-2.5 rounded-xl text-sm max-w-[260px] leading-relaxed whitespace-pre-wrap',
                msg.role === 'assistant'
                  ? 'bg-gray-50 text-gray-800 rounded-tl-sm'
                  : 'bg-brand-600 text-white rounded-tr-sm',
              )}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-brand-600" />
              </div>
              <div className="bg-gray-50 rounded-xl rounded-tl-sm px-3.5 py-3 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-3 flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escribe tu pregunta… (Enter para enviar)"
            rows={1}
            className="flex-1 resize-none text-sm rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 text-gray-800 placeholder:text-gray-400 max-h-28 scrollbar-thin"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 112) + 'px';
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="p-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Botón flotante ────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'w-14 h-14 rounded-full shadow-lg flex items-center justify-center',
          'transition-all duration-300 hover:scale-110 active:scale-95',
          open
            ? 'bg-gray-700 hover:bg-gray-800'
            : 'bg-brand-600 hover:bg-brand-700',
        )}
        title="Asesor Ley 1581"
      >
        {open
          ? <X className="w-6 h-6 text-white" />
          : <MessageCircle className="w-6 h-6 text-white" />}

        {/* Indicador de mensaje no leído */}
        {unread && !open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>
    </>
  );
}
