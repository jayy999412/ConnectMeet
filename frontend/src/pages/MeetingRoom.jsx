import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  MessageSquare,
  Users,
  PhoneOff,
  Copy,
  Check,
  Wifi,
  WifiOff,
  ShieldAlert,
  Flag,
  Circle,
  Square,
} from 'lucide-react';
import useAgora from '../hooks/useAgora.js';
import useMeetingChat from '../hooks/useMeetingChat.js';
import { meetingService } from '../services/meetingService.js';
import { agoraService } from '../services/agoraService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import VideoTile from '../components/VideoTile.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import ParticipantPanel from '../components/ParticipantPanel.jsx';
import Loader from '../components/Loader.jsx';

const PREFS_KEY = 'connectmeet_prefs';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch {
    return {};
  }
}

function elapsed(fromIso) {
  if (!fromIso) return '00:00';
  const s = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export default function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const prefs = useMemo(loadPrefs, []);

  /* ---------------------------------------------------------- meeting data */
  const [phase, setPhase] = useState('loading'); // loading | error | ready
  const [error, setError] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [you, setYou] = useState({ role: 'participant', status: null });

  const [panel, setPanel] = useState(null); // null | 'chat' | 'people'
  const [copied, setCopied] = useState(false);
  const [, forceTick] = useState(0);
  const [ended, setEnded] = useState(false);
  const [removed, setRemoved] = useState(false);

  /* --------------------------------------------------------- local record */
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const isHost = you.role === 'host';
  const onlineUids = useRef(null);

  /* ------------------------------------------------------- bootstrap logic */
  const bootstrap = useCallback(async () => {
    setPhase('loading');
    setEnded(false);
    setRemoved(false);
    try {
      const data = await meetingService.get(meetingId);
      setMeeting(data.meeting);
      setParticipants(data.participants || []);
      setYou(data.you || { role: 'participant', status: null });

      // Terminal states must be shown BEFORE attempting to join, otherwise the
      // join call would replace them with a generic error.
      if (data.meeting.status === 'ended') {
        setEnded(true);
        setPhase('ready');
        return;
      }
      if (data.you?.status === 'removed') {
        setRemoved(true);
        setPhase('ready');
        return;
      }

      // Entering the room always registers participation. The call is
      // idempotent (it upserts the participant row) and it is what flips the
      // meeting from `waiting` to `live`. A password-protected meeting that was
      // never joined through the join page fails here with a clear message.
      const joined = await meetingService.join(meetingId, {});
      setMeeting(joined.meeting || data.meeting);
      if (joined.participants) setParticipants(joined.participants);
      if (joined.you) setYou(joined.you);

      setPhase('ready');
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  }, [meetingId]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  /* --------------------------------------------------------- polling loop */
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const tick = async () => {
      try {
        const data = await meetingService.get(meetingId);
        setMeeting(data.meeting);
        setParticipants(data.participants || []);
        setYou(data.you || { role: 'participant', status: null });

        if (data.meeting.status === 'ended') setEnded(true);
        if (data.you?.status === 'removed') setRemoved(true);
        forceTick((n) => n + 1);
      } catch {
        /* transient failure — the next tick retries */
      }
    };
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [phase, meetingId]);

  /* ------------------------------------------------------- Agora RTC setup */
  const fetchToken = useCallback(
    () => agoraService.getToken({ meetingId, channel: String(meetingId), role: you.role }),
    [meetingId, you.role]
  );

  const [tokenInfo, setTokenInfo] = useState(null);
  const [tokenError, setTokenError] = useState(null);

  useEffect(() => {
    if (phase !== 'ready' || ended || removed) return;
    let alive = true;
    fetchToken()
      .then((data) => alive && setTokenInfo(data))
      .catch((err) => {
        if (alive) setTokenError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [phase, ended, removed, fetchToken]);

  const agora = useAgora({
    enabled: phase === 'ready' && Boolean(tokenInfo) && !ended && !removed,
    appId: tokenInfo?.appId || agoraService.appId(),
    getToken: fetchToken,
    channel: String(meetingId),
    uid: tokenInfo?.uid ?? user?.id,
    startWithCam: prefs.joinWithCamOn !== false,
    startWithMic: Boolean(prefs.joinWithMicOn),
  });

  /* --------------------------------------------------------------- chat */
  const chat = useMeetingChat({
    meetingId,
    appId: tokenInfo?.appId || agoraService.appId(),
    rtmToken: tokenInfo?.rtmToken,
    uid: tokenInfo?.uid ?? user?.id,
    userName: user?.name,
    enabled: phase === 'ready' && !ended && !removed,
  });

  /* -------------------------------------------------------- participant ids */
  useEffect(() => {
    onlineUids.current = new Set([
      user?.id,
      ...agora.remotes.map((r) => r.uid),
      ...participants.filter((p) => !p.left_at && p.status === 'active').map((p) => p.user_id),
    ]);
  }, [agora.remotes, participants, user?.id]);

  /* --------------------------------------------------------- notifications */
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (!prefs.participantNotifications || phase !== 'ready') return;
    const prev = prevCountRef.current;
    if (prev && participants.length > prev) {
      toast.info(`${participants.length - prev} participant(s) joined`);
    }
    prevCountRef.current = participants.length;
  }, [participants.length, phase, prefs.participantNotifications, toast]);

  /* ------------------------------------------------------- leave / end now */
  const hangUp = useCallback(async () => {
    try {
      await meetingService.leave(meetingId);
    } catch {
      /* the backend also cleans up on disconnect */
    }
    await agora.leave();
    navigate('/dashboard', { replace: true });
  }, [agora, meetingId, navigate]);

  const endForEveryone = useCallback(async () => {
    if (!window.confirm('End this meeting for everyone?')) return;
    try {
      await meetingService.end(meetingId);
      setEnded(true);
      await agora.leave();
      toast.success('Meeting ended');
    } catch (err) {
      toast.error(err.message);
    }
  }, [agora, meetingId, toast]);

  // Leaving the browser tab also releases the participant record.
  useEffect(() => {
    const onUnload = () => {
      navigator.sendBeacon?.(
        `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/meetings/${meetingId}/leave`,
        new Blob([], { type: 'application/json' })
      );
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [meetingId]);

  /* --------------------------------------------------------- copy invite */
  const copyInvite = async () => {
    const link = `${window.location.origin}/join?code=${encodeURIComponent(meeting?.meeting_code || '')}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Invitation link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  /* ------------------------------------------------------ local recording */
  const toggleRecording = () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    const tracks = [
      agora.local.videoTrack?.getMediaTrack?.(),
      agora.local.audioTrack?.getMediaTrack?.(),
    ].filter(Boolean);

    if (!tracks.length) {
      toast.error('Turn on your camera or microphone before recording.');
      return;
    }
    if (
      !window.confirm(
        'Start a local recording?\n\n• The file is saved to THIS device only and is never uploaded.\n• Always obtain consent from every participant before recording.'
      )
    ) {
      return;
    }

    try {
      const stream = new MediaStream(tracks);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `connectmeet-${(meeting?.title || 'meeting').replace(/[^\w-]+/g, '-').toLowerCase()}-${Date.now()}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        setRecording(false);
        toast.success('Recording saved to your device');
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      toast.info('Local recording started');
    } catch {
      toast.error('Recording is not supported in this browser.');
    }
  };

  /* ------------------------------------------------------------- renderers */
  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader label="Connecting to the meeting…" size="lg" />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-rose-500/15 text-rose-400">
          <ShieldAlert size={30} />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-white">Unable to open the meeting</h1>
        <p className="mt-2 max-w-md text-sm text-slate-400">{error}</p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => navigate('/join')} className="btn-primary">
            Join with a meeting ID
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (ended || removed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-800 text-slate-300">
          <Flag size={28} />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-white">
          {removed ? 'You were removed from this meeting' : 'This meeting has ended'}
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          {removed
            ? 'The host removed you from the meeting. You can rejoin only if the host allows it.'
            : 'The host ended the meeting for everyone. You can create or join another one.'}
        </p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary mt-6">
          Back to dashboard
        </button>
      </div>
    );
  }

  // When the server has no Agora credentials, the room still works for chat,
  // participants and host controls — only audio/video is unavailable. We show
  // an honest in-room notice instead of blocking the whole meeting.
  const videoDisabled = Boolean(tokenError);

  /* ------------------------------------------------------------ main view */
  const remoteTiles = agora.remotes;
  const totalTiles = remoteTiles.length + 1;
  const cols =
    totalTiles <= 1
      ? 'grid-cols-1 max-w-3xl'
      : totalTiles <= 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : totalTiles <= 4
          ? 'grid-cols-1 sm:grid-cols-2'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  const nameFor = (uid) =>
    participants.find((p) => p.user_id === uid)?.name || 'Participant';
  const roleFor = (uid) => participants.find((p) => p.user_id === uid)?.role;

  const localVideoTrack = agora.sharing ? agora.screenTrack : agora.local.videoTrack;

  const panelContent =
    panel === 'chat' ? (
      <ChatPanel
        chat={chat}
        currentUserId={user?.id}
        onClose={() => setPanel(null)}
      />
    ) : (
      <ParticipantPanel
        participants={participants}
        meetingId={meetingId}
        currentUserId={user?.id}
        onlineUids={new Set([...(agora.remotes.map((r) => r.uid)), user?.id])}
        isHost={isHost}
        onClose={() => setPanel(null)}
        onRemoved={() => bootstrap()}
      />
    );

  const connOk = ['CONNECTED', 'CONNECTING'].includes(agora.connectionState);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-slate-950">
      {/* ------------------------------------------------------ top bar */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/70 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-xs font-bold text-white">
            CM
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-white">{meeting?.title}</h1>
            <button
              onClick={copyInvite}
              className="flex items-center gap-1.5 text-[11px] text-slate-400 transition hover:text-brand-300"
              title="Copy invitation link"
            >
              <span className="font-mono tracking-widest">{meeting?.meeting_code}</span>
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {recording && (
            <span className="badge hidden bg-rose-500/15 px-2 py-1 text-rose-300 sm:inline-flex">
              <Circle size={9} className="animate-pulse fill-rose-400 text-rose-400" /> REC
            </span>
          )}
          <span
            className={`badge px-2 py-1 ${
              videoDisabled
                ? 'bg-slate-700 text-slate-300'
                : connOk
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-amber-500/15 text-amber-300'
            }`}
            title={videoDisabled ? 'Media disabled: Agora is not configured on the server' : `Connection: ${agora.connectionState}`}
          >
            {videoDisabled ? <VideoOff size={12} /> : connOk ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span className="hidden sm:inline">{videoDisabled ? 'Video off' : agora.connectionState}</span>
          </span>
          <span className="badge bg-slate-800 px-2 py-1 font-mono text-slate-300">
            {elapsed(meeting?.started_at || meeting?.created_at)}
          </span>
          <span className="badge bg-slate-800 px-2 py-1 text-slate-300">
            <Users size={12} /> {participants.filter((p) => p.status === 'active').length || 1}
          </span>
        </div>
      </header>

      {agora.mediaError && (
        <div className="flex shrink-0 items-center justify-between gap-3 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          <span>{agora.mediaError}</span>
          <button onClick={agora.clearMediaError} className="text-amber-300 hover:text-amber-100">
            Dismiss
          </button>
        </div>
      )}

      {agora.fatalError && (
        <div className="flex shrink-0 items-center justify-center bg-rose-500/15 px-4 py-2.5 text-sm text-rose-200">
          {agora.fatalError}
        </div>
      )}

      {videoDisabled && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          <ShieldAlert size={13} /> {tokenError} Chat and participant controls still work.
        </div>
      )}

      {!connOk && !agora.fatalError && !videoDisabled && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          <WifiOff size={13} /> Reconnecting to the meeting…
        </div>
      )}

      {/* --------------------------------------------------- body + panel */}
      <div className="relative flex min-h-0 flex-1">
        <main className="scroll-thin min-w-0 flex-1 overflow-y-auto p-4">
          {videoDisabled ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-800 text-slate-500">
                <VideoOff size={28} />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-300">Video and audio are off</p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  The server has not been configured with Agora credentials yet, so no media can be
                  published. Open the chat or participants panel while you wait.
                </p>
              </div>
            </div>
          ) : agora.joining ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Loader label={prefs.joinWithCamOn === false ? 'Joining…' : 'Requesting camera & microphone…'} />
              <p className="text-xs text-slate-500">Accept the browser permission prompts to be seen.</p>
            </div>
          ) : (
            <div className={`mx-auto grid h-full content-center gap-4 ${cols}`}>
              {/* Local tile */}
              <VideoTile
                name={user?.name || 'You'}
                isLocal
                isHost={isHost}
                videoTrack={localVideoTrack}
                audioTrack={agora.local.audioTrack}
                micOn={agora.micOn}
                camOn={agora.sharing ? true : agora.camOn}
                speaking={Boolean(agora.speakers[tokenInfo?.uid ?? user?.id] > 15)}
                screenSharing={agora.sharing}
              />

              {remoteTiles.map((r) => (
                <VideoTile
                  key={r.uid}
                  name={nameFor(r.uid)}
                  isHost={roleFor(r.uid) === 'host'}
                  videoTrack={r.videoTrack}
                  audioTrack={r.audioTrack}
                  micOn={r.hasAudio}
                  camOn={r.hasVideo}
                  speaking={Boolean(agora.speakers[r.uid] > 15)}
                />
              ))}
            </div>
          )}
        </main>

        {panel && (
          <div className="absolute inset-0 z-30 bg-white md:relative md:z-auto md:w-[340px] md:shrink-0">
            {panelContent}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------- controls */}
      <footer className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur sm:gap-3">
        <ControlButton
          active={agora.micOn}
          onClick={agora.toggleMic}
          label={videoDisabled ? 'Microphone unavailable — Agora not configured' : agora.micOn ? 'Mute' : 'Unmute'}
          danger={!agora.micOn}
          disabled={videoDisabled}
        >
          {agora.micOn ? <Mic size={19} /> : <MicOff size={19} />}
        </ControlButton>

        <ControlButton
          active={agora.camOn}
          onClick={agora.toggleCam}
          label={videoDisabled ? 'Camera unavailable — Agora not configured' : agora.camOn ? 'Stop video' : 'Start video'}
          danger={!agora.camOn}
          disabled={videoDisabled}
        >
          {agora.camOn ? <VideoIcon size={19} /> : <VideoOff size={19} />}
        </ControlButton>

        <ControlButton
          active={agora.sharing}
          onClick={agora.toggleShare}
          label={videoDisabled ? 'Screen sharing unavailable — Agora not configured' : agora.sharing ? 'Stop sharing' : 'Share screen'}
          disabled={videoDisabled}
        >
          <MonitorUp size={19} />
        </ControlButton>

        <ControlButton
          active={panel === 'chat'}
          onClick={() => setPanel((p) => (p === 'chat' ? null : 'chat'))}
          label="Chat"
          badge={chat.messages.length}
        >
          <MessageSquare size={19} />
        </ControlButton>

        <ControlButton
          active={panel === 'people'}
          onClick={() => setPanel((p) => (p === 'people' ? null : 'people'))}
          label="Participants"
          badge={participants.length}
        >
          <Users size={19} />
        </ControlButton>

        <ControlButton
          active={recording}
          onClick={toggleRecording}
          label={videoDisabled ? 'Recording unavailable — no media stream' : recording ? 'Stop recording' : 'Record locally'}
          danger={recording}
          disabled={videoDisabled}
        >
          {recording ? <Square size={17} /> : <Circle size={17} />}
        </ControlButton>

        {isHost && (
          <button
            onClick={endForEveryone}
            className="btn bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 sm:text-sm"
            title="End the meeting for everyone"
          >
            <Flag size={16} /> <span className="hidden sm:inline">End for all</span>
          </button>
        )}

        <button
          onClick={hangUp}
          className="btn bg-slate-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-600 sm:text-sm"
        >
          <PhoneOff size={16} /> Leave
        </button>
      </footer>
    </div>
  );
}

function ControlButton({ children, label, onClick, active, danger, badge, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={Boolean(active)}
      className={`relative grid h-12 w-12 place-items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
        disabled
          ? 'cursor-not-allowed bg-slate-800 text-slate-500'
          : active
            ? 'bg-white text-slate-900 hover:bg-slate-100'
            : danger
              ? 'bg-rose-600 text-white hover:bg-rose-700'
              : 'bg-slate-700 text-white hover:bg-slate-600'
      }`}
    >
      {children}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-[18px] text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
}
