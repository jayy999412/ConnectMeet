import { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Bell,
  Monitor,
  Mic,
  Camera,
  Info,
  Trash2,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useNavigate } from 'react-router-dom';

const PREFS_KEY = 'connectmeet_prefs';

const DEFAULT_PREFS = {
  joinWithMicOn: false,
  joinWithCamOn: true,
  chatNotifications: true,
  participantNotifications: true,
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function Toggle({ checked, onChange, label, description, icon: Icon }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
      <span className="flex gap-3">
        <Icon size={18} className="mt-0.5 shrink-0 text-slate-400" />
        <span>
          <span className="block text-sm font-medium text-slate-800">{label}</span>
          <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-brand-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

export default function Settings() {
  const { logout, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState(loadPrefs);
  const [devices, setDevices] = useState({ cameras: [], mics: [] });

  // Persist preferences locally (they only affect this browser/device).
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore storage errors */
    }
  }, [prefs]);

  // Real device enumeration — requires permission on first use in most browsers.
  useEffect(() => {
    let alive = true;
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const refresh = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (!alive) return;
        setDevices({
          cameras: list.filter((d) => d.kind === 'videoinput'),
          mics: list.filter((d) => d.kind === 'audioinput'),
        });
      } catch {
        /* permission not granted yet — list stays empty */
      }
    };

    refresh();
    navigator.mediaDevices.addEventListener?.('devicechange', refresh);
    return () => {
      alive = false;
      navigator.mediaDevices.removeEventListener?.('devicechange', refresh);
    };
  }, []);

  const update = (key) => (value) => setPrefs((p) => ({ ...p, [key]: value }));

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <SettingsIcon className="text-brand-600" size={22} /> Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Preferences are stored locally on this device.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Meeting preferences */}
        <section className="card overflow-hidden">
          <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Bell size={16} className="text-brand-500" />
            <h2 className="text-sm font-semibold text-slate-900">Meeting preferences</h2>
          </header>
          <Toggle
            icon={Camera}
            label="Start with camera on"
            description="Enable your camera automatically when you enter a room."
            checked={prefs.joinWithCamOn}
            onChange={update('joinWithCamOn')}
          />
          <Toggle
            icon={Mic}
            label="Start with microphone on"
            description="Unmute yourself automatically when you enter a room."
            checked={prefs.joinWithMicOn}
            onChange={update('joinWithMicOn')}
          />
          <Toggle
            icon={Bell}
            label="Chat notifications"
            description="Show a toast when new chat messages arrive."
            checked={prefs.chatNotifications}
            onChange={update('chatNotifications')}
          />
          <Toggle
            icon={Monitor}
            label="Participant notifications"
            description="Show a toast when someone joins or leaves the meeting."
            checked={prefs.participantNotifications}
            onChange={update('participantNotifications')}
          />
        </section>

        {/* Devices */}
        <section className="card overflow-hidden">
          <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Monitor size={16} className="text-violet-500" />
            <h2 className="text-sm font-semibold text-slate-900">Detected devices</h2>
          </header>
          <div className="space-y-4 p-5">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Camera size={13} /> Camera
              </p>
              {devices.cameras.length ? (
                <ul className="space-y-1.5">
                  {devices.cameras.map((d, i) => (
                    <li
                      key={d.deviceId || i}
                      className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600"
                    >
                      {d.label || `Camera ${i + 1}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">
                  No cameras detected — allow microphone &amp; camera permission to list devices.
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Mic size={13} /> Microphone
              </p>
              {devices.mics.length ? (
                <ul className="space-y-1.5">
                  {devices.mics.map((d, i) => (
                    <li
                      key={d.deviceId || i}
                      className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600"
                    >
                      {d.label || `Microphone ${i + 1}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">
                  No microphones detected yet.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-secondary w-full"
            >
              Re-detect devices
            </button>
          </div>
        </section>
      </div>

      {/* Recording policy — honest, no paid dependencies */}
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Info size={16} className="text-sky-500" /> About recording
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          ConnectMeet does <strong>not</strong> offer cloud recording. Server-side recording
          requires Agora Cloud Recording, which is a paid service, and free storage for uploaded
          recordings cannot be guaranteed. Instead, the meeting room provides an optional{' '}
          <strong>local recording</strong> that uses your browser&apos;s MediaRecorder API: the file
          is saved directly to your own device and is never uploaded anywhere. Always obtain consent
          from participants before recording.
        </p>
      </section>

      {/* Session */}
      <section className="card overflow-hidden">
        <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <LogOut size={16} className="text-rose-500" />
          <h2 className="text-sm font-semibold text-slate-900">Session</h2>
        </header>
        <div className="flex flex-col items-start justify-between gap-4 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-slate-800">Signed in as {user?.email}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Logging out clears your session token from this device.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                try {
                  localStorage.clear();
                } catch {
                  /* ignore */
                }
                toast.info('Local preferences cleared');
              }}
              className="btn-secondary"
            >
              <Trash2 size={15} /> Clear local data
            </button>
            <button onClick={handleLogout} className="btn-danger">
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
