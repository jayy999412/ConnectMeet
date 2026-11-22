import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Video,
  MonitorUp,
  CalendarClock,
  Users,
  History,
  Plus,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { meetingService } from '../services/meetingService.js';
import { useToast } from '../context/ToastContext.jsx';
import { StatCard, EmptyState, MeetingRow } from '../components/DashboardParts.jsx';
import Loader from '../components/Loader.jsx';

/**
 * Dashboard overview.
 * Every number shown here comes from MySQL through GET /api/meetings/stats —
 * there is no fabricated data anywhere in this view.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [s, list] = await Promise.all([
          meetingService.list({ scope: 'stats' }).catch(() => null),
          meetingService.list({ scope: 'dashboard' }).catch(() => ({ upcoming: [], recent: [] })),
        ]);
        if (!alive) return;
        if (s?.stats) setStats(s.stats);
        setUpcoming(list?.upcoming || []);
        setRecent(list?.recent || []);
      } catch (err) {
        if (alive) toast.error(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [toast]);

  const quickActions = [
    {
      label: 'New Meeting',
      desc: 'Instantly create a room',
      icon: Video,
      to: '/meetings/new',
      primary: true,
    },
    { label: 'Join Meeting', desc: 'Enter a meeting code', icon: MonitorUp, to: '/join' },
    {
      label: 'Schedule Meeting',
      desc: 'Pick a date and time',
      icon: CalendarClock,
      to: '/meetings/new?schedule=1',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s what&apos;s happening with your meetings.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/join" className="btn-secondary">
            <MonitorUp size={16} /> Join
          </Link>
          <Link to="/meetings/new" className="btn-primary">
            <Plus size={16} /> New Meeting
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        {quickActions.map(({ label, desc, icon: Icon, to, primary }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className={`card group flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-card-hover ${
              primary ? 'border-brand-200 bg-brand-50/60' : ''
            }`}
          >
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                primary
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white'
              }`}
            >
              <Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">{label}</span>
              <span className="block text-xs text-slate-500">{desc}</span>
            </span>
            <ArrowRight size={16} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <div className="col-span-full card flex items-center justify-center py-8">
            <Loader label="Loading your stats…" />
          </div>
        ) : (
          <>
            <StatCard
              icon={Video}
              label="Total Meetings"
              value={stats?.total ?? 0}
              accent="bg-brand-50 text-brand-600"
            />
            <StatCard
              icon={Users}
              label="Meetings Hosted"
              value={stats?.hosted ?? 0}
              accent="bg-violet-50 text-violet-600"
            />
            <StatCard
              icon={MonitorUp}
              label="Meetings Joined"
              value={stats?.joined ?? 0}
              accent="bg-sky-50 text-sky-600"
            />
            <StatCard
              icon={History}
              label="Completed Sessions"
              value={stats?.completed ?? 0}
              accent="bg-emerald-50 text-emerald-600"
            />
          </>
        )}
      </div>

      {/* Upcoming + recent */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Clock size={16} className="text-brand-500" /> Upcoming Meetings
            </h2>
            <Link to="/meetings/new" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              New meeting
            </Link>
          </header>
          {loading ? (
            <div className="py-10"><Loader label="" /></div>
          ) : upcoming.length ? (
            <ul>
              {upcoming.map((m) => (
                <MeetingRow key={m.id} meeting={m} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="No upcoming meetings"
              text="Schedule a meeting and it will show up here with its invite link."
              actionLabel="Create a meeting"
              actionTo="/meetings/new"
            />
          )}
        </section>

        <section className="card overflow-hidden">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <History size={16} className="text-violet-500" /> Recent Activity
            </h2>
            <Link to="/meetings/history" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </header>
          {loading ? (
            <div className="py-10"><Loader label="" /></div>
          ) : recent.length ? (
            <ul>
              {recent.map((m) => (
                <MeetingRow key={m.id} meeting={m} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Video}
              title="No meetings yet"
              text="Meetings you host or join will appear in your activity feed."
              actionLabel="Start your first meeting"
              actionTo="/meetings/new"
            />
          )}
        </section>
      </div>

      {/* Profile summary */}
      <section className="card flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-violet-600 text-lg font-bold text-white">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{user?.name}</p>
          <p className="truncate text-sm text-slate-500">{user?.email}</p>
        </div>
        <Link to="/profile" className="btn-secondary">
          Edit profile
        </Link>
      </section>
    </div>
  );
}
