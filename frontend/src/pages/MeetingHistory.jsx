import { useEffect, useState } from 'react';
import { History, CalendarDays, Clock, User, Filter } from 'lucide-react';
import { meetingService } from '../services/meetingService.js';
import { useToast } from '../context/ToastContext.jsx';
import { EmptyState } from '../components/DashboardParts.jsx';
import Loader from '../components/Loader.jsx';

function formatDuration(start, end) {
  if (!start) return '—';
  const ms = (end ? new Date(end) : new Date()) - new Date(start);
  if (ms < 0) return '—';
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const secs = Math.floor((ms % 60000) / 1000);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export default function MeetingHistory() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    meetingService
      .history()
      .then((data) => {
        if (alive) setRows(data.meetings || []);
      })
      .catch((err) => {
        if (alive) toast.error(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [toast]);

  const filtered = rows.filter((r) => {
    if (filter === 'hosted') return r.role === 'host';
    if (filter === 'joined') return r.role === 'participant';
    return true;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <History className="text-brand-600" size={22} /> Meeting History
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Every meeting you hosted or joined, with real timings from the database.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Filter size={15} className="text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-transparent text-sm text-slate-600 focus:outline-none"
            aria-label="Filter meeting history"
          >
            <option value="all">All meetings</option>
            <option value="hosted">Hosted by me</option>
            <option value="joined">Joined by me</option>
          </select>
        </div>
      </header>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16">
            <Loader label="Loading history…" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={History}
            title={rows.length === 0 ? 'No meeting history yet' : 'No meetings match this filter'}
            text={
              rows.length === 0
                ? 'Once you host or join a meeting, the details will appear here.'
                : 'Try a different filter to see more meetings.'
            }
            actionLabel={rows.length === 0 ? 'Create your first meeting' : undefined}
            actionTo="/meetings/new"
          />
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Meeting</th>
                  <th className="px-5 py-3 font-medium">Host</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium">Left</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 transition hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{r.title}</p>
                      <p className="mt-0.5 font-mono text-xs tracking-wider text-slate-400">
                        {r.meeting_code}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{r.host_name}</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {r.joined_at ? new Date(r.joined_at).toLocaleTimeString() : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {r.left_at ? new Date(r.left_at).toLocaleTimeString() : '—'}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-700">
                      {formatDuration(r.joined_at, r.left_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`badge ${
                          r.meeting_status === 'live'
                            ? 'bg-emerald-50 text-emerald-700'
                            : r.meeting_status === 'ended'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-brand-50 text-brand-700'
                        }`}
                      >
                        {r.meeting_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {filtered.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{r.title}</p>
                      <p className="mt-0.5 font-mono text-xs tracking-wider text-slate-400">
                        {r.meeting_code}
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        r.meeting_status === 'live'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {r.meeting_status}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <User size={13} /> {r.host_name}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarDays size={13} />{' '}
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} /> {formatDuration(r.joined_at, r.left_at)}
                    </div>
                    <div>
                      {r.joined_at
                        ? `Joined ${new Date(r.joined_at).toLocaleTimeString()}`
                        : 'Never joined'}
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
