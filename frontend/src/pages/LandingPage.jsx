import { Link, useNavigate } from 'react-router-dom';
import {
  Video,
  MessageSquare,
  MonitorUp,
  ShieldCheck,
  Users,
  Clock,
  Globe,
  Zap,
  ArrowRight,
  CheckCircle2,
  Lock,
  Server,
  Sparkles,
} from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  {
    icon: Video,
    title: 'HD Video & Audio',
    text: 'Crystal-clear live video and audio powered by Agora, optimised for real-world network conditions.',
  },
  {
    icon: MonitorUp,
    title: 'Screen Sharing',
    text: 'Share your entire screen or a window to present ideas, demos and documents instantly.',
  },
  {
    icon: MessageSquare,
    title: 'Real-Time Chat',
    text: 'Exchange messages during the meeting with history persisted and scoped to each meeting.',
  },
  {
    icon: Users,
    title: 'Participant Management',
    text: 'See who is in the room, who is speaking, and let hosts remove disruptive participants.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by Design',
    text: 'JWT authentication, hashed passwords and backend-generated Agora tokens — no secrets in the browser.',
  },
  {
    icon: Clock,
    title: 'Scheduled Meetings',
    text: 'Create meetings ahead of time, share the invite link and see everything in your dashboard.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Create your account',
    text: 'Register in seconds with your name, email and a strong password.',
  },
  {
    n: '02',
    title: 'Start or join a meeting',
    text: 'Generate a unique meeting code, or enter an existing one to join instantly.',
  },
  {
    n: '03',
    title: 'Connect face to face',
    text: 'Turn on your camera, share your screen and collaborate in real time.',
  },
];

const WHY = [
  { icon: Zap, title: 'Effortless', text: 'No downloads for participants — meetings run straight in the browser.' },
  { icon: Globe, title: 'Everywhere', text: 'Works across laptops, phones and tablets on any modern browser.' },
  { icon: Sparkles, title: 'Focused', text: 'A clean, uncluttered interface that keeps the conversation front and centre.' },
];

const SECURITY = [
  'Passwords hashed with Werkzeug (never stored in plain text)',
  'JWT-based authentication for every private API',
  'Agora App Certificate stays on the server — tokens are minted by the backend',
  'Meeting chat history is only readable by authorized participants',
  'ORM-based queries that protect against SQL injection',
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const startMeeting = () => navigate(isAuthenticated ? '/meetings/new' : '/register?next=/meetings/new');
  const joinMeeting = () => navigate(isAuthenticated ? '/join' : '/register?next=/join');

  return (
    <div className="bg-white">
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,#eef2ff_0%,rgba(255,255,255,0)_70%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:pb-24 lg:pt-20">
          <div className="animate-fade-in-up">
            <span className="badge border border-brand-100 bg-brand-50 text-brand-700">
              <Sparkles size={13} /> Video meetings, reimagined
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Connect Anywhere.
              <br />
              <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">
                Meet Everywhere.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Experience seamless video meetings, real-time collaboration and effortless
              communication with ConnectMeet.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={startMeeting} className="btn-primary px-6 py-3 text-base">
                <Video size={18} /> Start a Meeting
              </button>
              <button onClick={joinMeeting} className="btn-secondary px-6 py-3 text-base">
                Join a Meeting <ArrowRight size={17} />
              </button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              {['No downloads required', 'Free to get started', 'Runs in your browser'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-500" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Original vector illustration of a video call */}
          <div className="relative animate-fade-in-up">
            <div className="card relative mx-auto max-w-lg p-4">
              <div className="flex items-center justify-between px-1 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="badge bg-slate-100 text-slate-600">Team Stand-up</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'Aarav', hue: 'from-brand-500 to-violet-500', live: true },
                  { name: 'Sara', hue: 'from-sky-500 to-indigo-500', live: false },
                  { name: 'Ravi', hue: 'from-violet-500 to-fuchsia-500', live: false },
                  { name: 'Meera', hue: 'from-emerald-500 to-teal-500', live: true },
                ].map((p) => (
                  <div
                    key={p.name}
                    className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-900"
                  >
                    <div
                      className={`absolute inset-0 grid place-items-center bg-gradient-to-br ${p.hue} opacity-90`}
                    >
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/95 text-base font-bold text-slate-800">
                        {p.name[0]}
                      </span>
                    </div>
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                      {p.name}
                    </span>
                    {p.live && (
                      <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2">
                {[
                  { on: true },
                  { on: true },
                  { on: false },
                  { on: false },
                ].map((c, i) => (
                  <span
                    key={i}
                    className={`grid h-10 w-10 place-items-center rounded-full ${
                      c.on ? 'bg-slate-900 text-white' : 'bg-rose-500 text-white'
                    }`}
                  >
                    {i === 0 ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z" />
                        <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21a1 1 0 1 0 2 0v-3.08A7 7 0 0 0 19 11z" />
                      </svg>
                    ) : i === 1 ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
                      </svg>
                    ) : i === 2 ? (
                      <MonitorUp size={16} />
                    ) : (
                      <Users size={16} />
                    )}
                  </span>
                ))}
              </div>
            </div>

            <div className="absolute -bottom-5 -left-3 hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-card sm:flex sm:items-center sm:gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <ShieldCheck size={16} />
              </span>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-slate-800">End-to-end secured</p>
                <p className="text-[11px] text-slate-500">Tokens generated server-side</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ FEATURES */}
      <section id="features" className="scroll-mt-20 border-t border-slate-100 bg-slate-50/70 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything you need to meet online
            </h2>
            <p className="mt-3 text-slate-600">
              A complete set of collaboration tools, built for teams that move fast.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="card group p-6 transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                  <Icon size={21} />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- STEPS */}
      <section id="about" className="scroll-mt-20 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                How ConnectMeet works
              </h2>
              <p className="mt-3 max-w-md text-slate-600">
                Three steps from opening the app to a real conversation.
              </p>
              <Link to="/register" className="btn-primary mt-6">
                Create a free account <ArrowRight size={16} />
              </Link>
            </div>
            <ol className="space-y-6">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-sm font-bold text-white">
                    {s.n}
                  </span>
                  <div className="pt-1">
                    <h3 className="font-semibold text-slate-900">{s.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ WHY */}
      <section className="border-y border-slate-100 bg-gradient-to-b from-white to-brand-50/50 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Why choose ConnectMeet
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {WHY.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card p-7 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-600">
                  <Icon size={22} />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ SECURITY */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div className="card bg-slate-900 p-8 text-white">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-brand-300">
              <Lock size={22} />
            </span>
            <h3 className="mt-5 text-xl font-semibold">Security & privacy first</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Every private API is protected by JWT authentication, and meeting access is
              verified against the database before a video token is ever issued.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="badge bg-white/10 text-slate-200">JWT Auth</span>
              <span className="badge bg-white/10 text-slate-200">Hashed passwords</span>
              <span className="badge bg-white/10 text-slate-200">Server-side tokens</span>
              <span className="badge bg-white/10 text-slate-200">Scoped chat history</span>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Built on secure foundations
            </h2>
            <ul className="mt-6 space-y-3">
              {SECURITY.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <Server size={18} className="shrink-0 text-slate-400" />
              Self-hosted Flask API with a health-check endpoint and environment-based configuration.
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ CTA */}
      <section className="px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 to-violet-600 px-6 py-14 text-center shadow-xl sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to meet?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            Create your free account and start your first ConnectMeet call in under a minute.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={() => navigate('/register')}
              className="btn bg-white px-6 py-3 text-brand-700 shadow-sm hover:bg-brand-50"
            >
              Get Started — it&apos;s free
            </button>
            <button
              onClick={joinMeeting}
              className="btn border border-white/40 px-6 py-3 text-white hover:bg-white/10"
            >
              Join a meeting
            </button>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <Logo />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500">
                ConnectMeet is a full-stack video conferencing platform for seamless meetings and
                real-time collaboration — anywhere, on any device.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900">Product</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><a href="#features" className="hover:text-brand-600">Features</a></li>
                <li><Link to="/login" className="hover:text-brand-600">Login</Link></li>
                <li><Link to="/register" className="hover:text-brand-600">Get Started</Link></li>
                <li><Link to="/join" className="hover:text-brand-600">Join a Meeting</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900">Contact</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><a href="mailto:support@connectmeet.app" className="hover:text-brand-600">support@connectmeet.app</a></li>
                <li><a href="#about" className="hover:text-brand-600">About us</a></li>
                <li><span className="text-slate-400">GitHub Free · Vercel Hobby · Render Free</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row">
            <p>© {new Date().getFullYear()} ConnectMeet. All rights reserved.</p>
            <p>Connect Anywhere. Meet Everywhere.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
