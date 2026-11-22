import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Check, Video, CalendarClock, Link as LinkIcon, Rocket } from 'lucide-react';
import { meetingService } from '../services/meetingService.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const initialDate = () => {
  const d = new Date(Date.now() + 30 * 60000);
  d.setSeconds(0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function CreateMeeting() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const scheduleByDefault = params.get('schedule') === '1';

  const [form, setForm] = useState({
    title: '',
    password: '',
    scheduled: scheduleByDefault,
    when: initialDate(),
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, api: undefined }));
  };

  const inviteLink = created
    ? `${window.location.origin}/join?code=${encodeURIComponent(created.meeting_code)}`
    : '';

  const validate = () => {
    const next = {};
    if (!form.title.trim()) next.title = 'Please give your meeting a title.';
    else if (form.title.trim().length > 120) next.title = 'Title must be under 120 characters.';

    if (form.password && form.password.length < 4)
      next.password = 'Password must be at least 4 characters.';

    if (form.scheduled) {
      const t = new Date(form.when).getTime();
      if (!form.when || Number.isNaN(t)) next.when = 'Pick a valid date and time.';
      else if (t < Date.now() - 60000) next.when = 'Scheduled time cannot be in the past.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        password: form.password || null,
        scheduled_at: form.scheduled ? new Date(form.when).toISOString() : null,
      };
      const data = await meetingService.create(payload);
      setCreated(data.meeting);
      toast.success('Meeting created. Invite link ready to share!');
    } catch (err) {
      if (err.errors) setErrors(err.errors);
      setErrors((prev) => ({ ...prev, api: err.message }));
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Invitation link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — please copy the link manually.');
    }
  };

  /* -------------------------------------------------- success state */
  if (created) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="card p-7 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <Check size={26} />
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Meeting created</h1>
          <p className="mt-1 text-sm text-slate-500">
            Share the details below so others can join.
          </p>

          <div className="mt-6 space-y-4 text-left">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Meeting title
              </p>
              <p className="mt-1 font-semibold text-slate-900">{created.title}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Meeting ID
              </p>
              <p className="mt-1 font-mono text-lg font-bold tracking-widest text-brand-700">
                {created.meeting_code}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Invitation link
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input readOnly className="input flex-1 font-mono text-xs" value={inviteLink} />
                <button onClick={copyLink} className="btn-primary shrink-0">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <LinkIcon size={13} /> Anyone with this link can open the join page.
              </p>
            </div>

            {created.has_password && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                Participants will be asked for the meeting password you set.
              </p>
            )}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button onClick={() => navigate(`/room/${created.id}`)} className="btn-primary px-6 py-3">
              <Rocket size={17} /> Start meeting now
            </button>
            <button onClick={() => navigate('/dashboard')} className="btn-secondary px-6 py-3">
              Back to dashboard
            </button>
          </div>
        </div>

        <button onClick={() => setCreated(null)} className="btn-ghost mx-auto block text-sm">
          Create another meeting
        </button>
      </div>
    );
  }

  /* ------------------------------------------------------ create form */
  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create a meeting</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate a unique meeting code and share it with your participants.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="card space-y-5 p-6 sm:p-7">
        {errors.api && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errors.api}
          </div>
        )}

        <div>
          <label className="label" htmlFor="title">Meeting title *</label>
          <input
            id="title"
            className="input"
            placeholder="e.g. Weekly design sync"
            value={form.title}
            onChange={set('title')}
            maxLength={120}
            aria-invalid={Boolean(errors.title)}
          />
          {errors.title && <p className="mt-1.5 text-xs text-rose-600">{errors.title}</p>}
        </div>

        <div>
          <label className="label" htmlFor="password">Meeting password (optional)</label>
          <input
            id="password"
            type="text"
            className="input"
            placeholder="Leave blank for an open meeting"
            value={form.password}
            onChange={set('password')}
            autoComplete="off"
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Participants must enter this password before joining.
          </p>
          {errors.password && <p className="mt-1.5 text-xs text-rose-600">{errors.password}</p>}
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <CalendarClock size={16} className="text-brand-500" /> Schedule for later
            </span>
            <input
              type="checkbox"
              checked={form.scheduled}
              onChange={set('scheduled')}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
          </label>

          {form.scheduled && (
            <div className="mt-3">
              <input
                type="datetime-local"
                className="input"
                value={form.when}
                onChange={set('when')}
                aria-label="Meeting date and time"
              />
              {errors.when && <p className="mt-1.5 text-xs text-rose-600">{errors.when}</p>}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Host: <span className="font-semibold text-slate-700">{user?.name}</span> — you&apos;ll be
          able to start, end and manage participants for this meeting.
        </div>

        <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
          <Video size={17} />
          {submitting ? 'Creating meeting…' : 'Create meeting'}
        </button>
      </form>
    </div>
  );
}
