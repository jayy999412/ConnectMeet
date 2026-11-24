import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, LogIn, Search, UserRound } from 'lucide-react';
import { meetingService } from '../services/meetingService.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { normalizeMeetingCode } from '../utils/meetingCode.js';
import { nextQuery } from '../utils/navigation.js';
import { PageLoader } from '../components/Loader.jsx';

/**
 * Join page — the destination of every invite link.
 *
 * Public by design: a recipient with no account must land here, type a name
 * and be in the meeting. Signed-in users skip the name field and join as
 * themselves. Both paths converge on the same backend rules (password,
 * status, host removals) and the same Agora token flow.
 *
 * The Meeting ID field accepts a bare code OR a pasted invite link.
 */
export default function JoinMeeting() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, booting, adoptSession } = useAuth();

  const [form, setForm] = useState({
    code: normalizeMeetingCode(params.get('code') || ''),
    password: '',
  });
  const [name, setName] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(Boolean(params.get('code')));

  // Pre-resolve an invite link so the visitor sees the meeting before entering.
  useEffect(() => {
    const raw = params.get('code');
    const code = normalizeMeetingCode(raw || '');
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

  // A returning guest may already hold a token; wait for session restore so we
  // don't flash the name field at someone who is effectively signed in.
  if (booting) {
    return (
      <div className="mx-auto max-w-xl">
        <PageLoader />
      </div>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    // Accept "paste the invite link" as well as a bare code.
    const code = normalizeMeetingCode(form.code);
    if (!code) next.code = 'Enter a meeting ID.';
    // Guests only supply the display name everyone will see in the meeting.
    const displayName = name.trim();
    if (!user && (displayName.length < 2 || displayName.length > 60)) {
      next.name = 'Enter your name (2-60 characters) to join.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      // Step 1: resolve the human-friendly code to the numeric meeting id.
      const resolved = await meetingService.resolve(code);
      const meetingId = resolved.meeting.id;

      if (user) {
        // Signed in: validate password/status and record the participant.
        await meetingService.join(meetingId, { password: form.password });
      } else {
        // No account: one call creates the guest identity, records the
        // participant and returns a session token — then we are "signed in"
        // as that guest for the rest of the visit.
        const data = await meetingService.guestJoin(meetingId, {
          name: displayName,
          password: form.password,
        });
        adoptSession(data.token, data.user);
      }

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
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
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

        {!user && (
          <div>
            <label className="label" htmlFor="guest-name">Your name</label>
            <div className="relative">
              <UserRound size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="guest-name"
                className="input pl-10"
                placeholder="The name others will see"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors({});
                }}
                maxLength={60}
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
              />
            </div>
            {errors.name ? (
              <p className="mt-1.5 text-xs text-rose-600">{errors.name}</p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-400">
                No account needed — just type your name and join.
              </p>
            )}
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
          Joining as{' '}
          <span className="font-semibold text-slate-700">{user?.name || name.trim() || 'Guest'}</span>
          . Camera and microphone access will be requested when you enter the room.
        </div>

        <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
          <LogIn size={17} />
          {submitting ? 'Joining…' : 'Join meeting'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        {user ? (
          <>
            Don&apos;t have a meeting ID?{' '}
            <button
              type="button"
              onClick={() => navigate('/meetings/new')}
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              Create one instead
            </button>
          </>
        ) : (
          <>
            Prefer your own account?{' '}
            <a
              href={`/login${nextQuery(`${location.pathname}${location.search}`)}`}
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              Log in
            </a>
            {' · '}
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              Sign up
            </button>
          </>
        )}
      </p>
    </div>
  );
}
