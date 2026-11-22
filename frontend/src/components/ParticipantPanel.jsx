import { useState } from 'react';
import { Users, UserMinus, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { meetingService } from '../services/meetingService.js';
import { useToast } from '../context/ToastContext.jsx';

const time = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

/**
 * Participant list.
 * Names, roles and join times come from MySQL; live connectivity comes from
 * the Agora channel (uid -> online set). Hosts can remove participants.
 */
export default function ParticipantPanel({
  participants,
  meetingId,
  currentUserId,
  onlineUids,
  isHost,
  onClose,
  onRemoved,
}) {
  const toast = useToast();
  const [removing, setRemoving] = useState(null);

  const removeParticipant = async (p) => {
    if (!window.confirm(`Remove ${p.name} from this meeting?`)) return;
    setRemoving(p.user_id);
    try {
      await meetingService.removeParticipant(meetingId, p.user_id);
      toast.success(`${p.name} was removed`);
      onRemoved?.(p.user_id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Users size={16} className="text-violet-500" /> Participants
          <span className="badge bg-slate-100 text-slate-600">{participants.length}</span>
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close participants"
          >
            ✕
          </button>
        )}
      </header>

      <ul className="scroll-thin flex-1 divide-y divide-slate-50 overflow-y-auto">
        {participants.map((p) => {
          const online = !onlineUids || onlineUids.has(p.user_id);
          const isMe = p.user_id === currentUserId;
          return (
            <li key={`${p.user_id}-${p.id}`} className="flex items-center gap-3 px-4 py-3">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-xs font-bold text-white">
                {(p.name || '?')
                  .split(' ')
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                    online ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {p.name}
                  {isMe && <span className="text-slate-400"> (you)</span>}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    {p.role === 'host' ? (
                      <>
                        <ShieldCheck size={11} className="text-brand-500" /> Host
                      </>
                    ) : (
                      'Participant'
                    )}
                  </span>
                  <span>· joined {time(p.joined_at)}</span>
                </p>
              </div>

              <span
                className={`flex items-center gap-1 text-[11px] ${
                  online ? 'text-emerald-600' : 'text-slate-400'
                }`}
                title={online ? 'Connected' : 'Disconnected'}
              >
                {online ? <Wifi size={13} /> : <WifiOff size={13} />}
              </span>

              {isHost && !isMe && (
                <button
                  onClick={() => removeParticipant(p)}
                  disabled={removing === p.user_id}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  aria-label={`Remove ${p.name}`}
                  title="Remove from meeting"
                >
                  <UserMinus size={15} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
        {isHost
          ? 'As host you can remove participants and end the meeting for everyone.'
          : 'Only the host can remove participants.'}
      </footer>
    </aside>
  );
}
