import { useEffect, useRef } from 'react';
import { MicOff, Pin } from 'lucide-react';

/**
 * One participant video.
 * Plays the Agora video track into the container when present and falls back
 * to an initials avatar when the camera is off or permission was denied.
 */
export default function VideoTile({
  name,
  videoTrack,
  audioTrack,
  isLocal = false,
  isHost = false,
  micOn = true,
  camOn = false,
  speaking = false,
  screenSharing = false,
  className = '',
}) {
  const containerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !videoTrack) return undefined;
    el.innerHTML = '';
    try {
      videoTrack.play(el);
    } catch {
      /* track may already be closed during teardown */
    }
    return () => {
      try {
        videoTrack.stop();
      } catch {
        /* ignore */
      }
    };
  }, [videoTrack]);

  // Remote audio is played once when the track arrives (see useAgora).
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioTrack) return undefined;
    return () => {
      try {
        audioTrack.stop();
      } catch {
        /* ignore */
      }
    };
  }, [audioTrack]);

  const initials = (name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={`group relative aspect-video overflow-hidden rounded-2xl bg-slate-900 shadow-card transition ${
        speaking ? 'ring-2 ring-emerald-400' : 'ring-1 ring-slate-800'
      } ${className}`}
    >
      <div ref={containerRef} className="absolute inset-0 [&>video]:h-full [&>video]:w-full [&>video]:object-cover" />

      {/* Avatar fallback — visible when there is no video track */}
      {!videoTrack && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-xl font-bold text-white shadow-lg">
            {initials}
          </span>
        </div>
      )}

      <div ref={audioRef} className="hidden" />

      {/* Label bar */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-6">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium text-white">
            {name}
            {isLocal ? ' (You)' : ''}
          </span>
          {isHost && (
            <span className="badge shrink-0 bg-brand-600/90 px-1.5 py-0 text-[10px] text-white">
              Host
            </span>
          )}
        </span>
        {!micOn && (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-500 text-white">
            <MicOff size={13} />
          </span>
        )}
      </div>

      {screenSharing && (
        <span className="absolute left-2 top-2 badge bg-sky-500/90 px-2 py-0.5 text-[10px] text-white">
          <Pin size={11} /> Presenting
        </span>
      )}
    </div>
  );
}
