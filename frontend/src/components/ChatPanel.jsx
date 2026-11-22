import { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare, Radio } from 'lucide-react';
import Loader from './Loader.jsx';

const time = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * In-meeting chat sidebar.
 * Messages are persisted per meeting in MySQL and pushed over Agora RTM with
 * a polling fallback (see hooks/useMeetingChat.js).
 */
export default function ChatPanel({ chat, currentUserId, onClose }) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const { messages, loading, sending, send, rtmState } = chat;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    try {
      await send(text);
    } catch (err) {
      // Restore the draft so the user does not lose their message.
      setDraft(text);
      console.error(err);
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MessageSquare size={16} className="text-brand-500" /> Meeting chat
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`badge ${
              rtmState === 'live'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
            title={
              rtmState === 'live'
                ? 'Real-time messaging connected'
                : 'Real-time push unavailable — syncing automatically'
            }
          >
            <Radio size={11} />
            {rtmState === 'live' ? 'Live' : 'Syncing'}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close chat"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <Loader label="Loading messages…" />
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <MessageSquare size={20} />
            </span>
            <p className="mt-3 text-sm font-medium text-slate-600">No messages yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Say hi to everyone in the meeting.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              return (
                <li key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {mine ? 'You' : m.sender_name || 'Participant'}
                    </span>
                    <span className="text-[10px] text-slate-400">{time(m.created_at)}</span>
                  </div>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      mine
                        ? 'rounded-br-md bg-brand-600 text-white'
                        : 'rounded-bl-md bg-slate-100 text-slate-800'
                    }`}
                  >
                    {m.message}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            placeholder="Type a message…"
            className="input max-h-28 min-h-[42px] resize-none py-2.5"
            maxLength={2000}
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="btn-primary h-[42px] w-[42px] shrink-0 px-0"
            aria-label="Send message"
          >
            <Send size={17} />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-slate-400">
          Press Enter to send · Shift+Enter for a new line
        </p>
      </form>
    </aside>
  );
}
