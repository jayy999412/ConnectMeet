import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/** Small reusable stat tile — always fed with real API data. */
export function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${accent}`}>
          <Icon size={19} />
        </span>
        <div>
          <p className="text-2xl font-bold leading-none text-slate-900">{value}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

/** Friendly empty state used across lists. */
export function EmptyState({ icon: Icon, title, text, actionLabel, actionTo }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        {Icon ? <Icon size={24} /> : <ArrowRight size={24} />}
      </span>
      <h3 className="mt-4 text-sm font-semibold text-slate-800">{title}</h3>
      {text && <p className="mt-1.5 max-w-xs text-sm text-slate-500">{text}</p>}
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn-primary mt-5">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function MeetingRow({ meeting }) {
  const when = meeting.scheduled_at
    ? new Date(meeting.scheduled_at).toLocaleString()
    : new Date(meeting.created_at).toLocaleString();

  const tone =
    meeting.status === 'live'
      ? 'bg-emerald-50 text-emerald-700'
      : meeting.status === 'ended'
        ? 'bg-slate-100 text-slate-600'
        : 'bg-brand-50 text-brand-700';

  return (
    <li className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">{meeting.title}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {meeting.meeting_code} · {when}
        </p>
      </div>
      <span className={`badge shrink-0 ${tone}`}>{meeting.status}</span>
    </li>
  );
}
