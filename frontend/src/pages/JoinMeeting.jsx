import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, LogIn, Search } from 'lucide-react';
import { meetingService } from '../services/meetingService.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Join page. Accepts ?code=ABCDE-FGHIJ from an invite link, resolves it to a
 * meeting, validates the optional password and enters the room only after the
 * backend has registered the participant and issued an Agora token.
 */
export default function JoinMeeting() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState({ code: params.get('code') || '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(Boolean(params.get('code')));

  // Pre-resolve an invite link so the user sees the meeting before entering.
  useEffect(() => {
    const code = params.get('code');
    if (!code) return;
    let alive = true;
    meetingService
      .resolve(code)
      .then((data) => {
        if (alive && data?.meeting) {
          setForm((f) => ({ ...f, code: data.meeting.meeting_code }));
        }
      })
      .catch((err) => {
        if (alive) toast.error(err.message);
      })
      .finally(() => alive && setResolving(false));
    return () => {
      alive = false;
    };
  }, [params, toast]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.code.trim()) next.code = 'Enter a meeting ID.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      // Step 1: resolve the human-friendly code to the numeric meeting id.
      const resolved = await meetingService.resolve(form.code.trim().toUpperCase());
      const meetingId = resolved.meeting.id;

      // Step 2: join — validates password/status and records the participant.
      await meetingService.join(meetingId, { password: form.password });

      toast.success(`Joining ${resolved.meeting.title}…`);
      navigate(`/room/${meetingId}`, { replace: true });
    } catch (err) {
      if (err.errors) setErrors(err.errors);
      setErrors((prev) => ({ ...prev, api: err.message }));
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Join a meeting</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the meeting ID from your invitation, or paste the invite link.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="card space-y-5 p-6 sm:p-7">
        {errors.api && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errors.api}
          </div>
        )}

        <div>
          <label className="label" htmlFor="code">Meeting ID</label>
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="code"
              className="input pl-10 font-mono uppercase tracking-widest"
              placeholder="XXXXX-XXXXX"
              value={form.code}
              onChange={(e) => {
                setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }));
                setErrors({});
              }}
              disabled={resolving}
              aria-invalid={Boolean(errors.code)}
            />
          </div>
          {errors.code && <p className="mt-1.5 text-xs text-rose-600">{errors.code}</p>}
          {resolving && <p className="mt-1.5 text-xs text-slate-400">Checking meeting ID…</p>}
        </div>

        <div>
          <label className="label" htmlFor="password">Meeting password (if required)</label>
          <div className="relative">
            <KeyRound size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type="text"
              className="input pl-10"
              placeholder="Only if the host set one"
              value={form.password}
              onChange={(e) => {
                setForm((f) => ({ ...f, password: e.target.value }));
                setErrors({});
              }}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Joining as <span className="font-semibold text-slate-700">{user?.name}</span>. Camera and
          microphone access will be requested when you enter the room.
        </div>

        <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
          <LogIn size={17} />
          {submitting ? 'Joining…' : 'Join meeting'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Don&apos;t have a meeting ID?{' '}
        <button
          type="button"
          onClick={() => navigate('/meetings/new')}
          className="font-semibold text-brand-600 hover:text-brand-700"
        >
          Create one instead
        </button>
      </p>
    </div>
  );
}
