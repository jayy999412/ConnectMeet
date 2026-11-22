import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  Video,
  History,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
  LogIn as JoinIcon,
} from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { PageLoader } from '../components/Loader.jsx';

const LINKS = [
  { label: 'Overview', to: '/dashboard', icon: LayoutDashboard, end: true },
  { label: 'My Meetings', to: '/meetings/new', icon: Video, end: false },
  { label: 'Meeting History', to: '/meetings/history', icon: History, end: false },
  { label: 'Profile', to: '/profile', icon: User, end: false },
  { label: 'Settings', to: '/settings', icon: Settings, end: false },
];

/** Authenticated app shell: fixed sidebar (drawer on mobile) + routed content. */
export default function DashboardLayout() {
  const { isAuthenticated, booting, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  if (booting) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo to="/dashboard" size="sm" />
        <button
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {LINKS.map(({ label, to, icon: Icon, end }) => (
          <NavLinkItem key={label} to={to} end={end} onClick={() => setMobileOpen(false)}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLinkItem>
        ))}
      </nav>

      <div className="space-y-2 border-t border-slate-100 p-3">
        <button
          onClick={() => {
            setMobileOpen(false);
            navigate('/meetings/new');
          }}
          className="btn-primary w-full"
        >
          <Plus size={16} /> New Meeting
        </button>
        <button
          onClick={() => {
            setMobileOpen(false);
            navigate('/join');
          }}
          className="btn-secondary w-full"
        >
          <JoinIcon size={16} /> Join Meeting
        </button>
        <button onClick={handleLogout} className="btn-ghost w-full text-slate-600">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl">{sidebar}</aside>
        </div>
      )}

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <button
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          onClick={() => setMobileOpen(true)}
          aria-label="Open sidebar"
        >
          <Menu size={22} />
        </button>
        <Logo size="sm" to="/dashboard" />
        <div className="w-10" />
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet context={{ user }} />
        </div>
      </main>
    </div>
  );
}

function NavLinkItem({ to, end, children, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
          isActive
            ? 'bg-brand-50 text-brand-700'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`
      }
    >
      {children}
    </NavLink>
  );
}
