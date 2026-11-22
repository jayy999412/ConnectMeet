import { useEffect, useState } from 'react';
import { User, Mail, CalendarDays, Save, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { profileService } from '../services/profileService.js';
import { useToast } from '../context/ToastContext.jsx';
import Loader from '../components/Loader.jsx';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    let alive = true;
    profileService
      .get()
      .then((data) => {
        if (!alive) return;
        setForm({ name: data.user.name, email: data.user.email });
        updateUser(data.user);
      })
      .catch((err) => {
        if (alive) {
          if (user) setForm({ name: user.name, email: user.email });
          toast.error(err.message);
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Name cannot be empty.';
    else if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const data = await profileService.update({ name: form.name.trim() });
      updateUser(data.user);
      toast.success('Profile updated');
    } catch (err) {
      if (err.errors) setErrors(err.errors);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onChangePw = async (e) => {
    e.preventDefault();
    const next = {};
    if (!pw.current) next.current = 'Enter your current password.';
    if (!pw.next) next.next = 'Enter a new password.';
    else if (pw.next.length < 8) next.next = 'New password must be at least 8 characters.';
    else if (!/[A-Z]/.test(pw.next) || !/[a-z]/.test(pw.next) || !/\d/.test(pw.next))
      next.next = 'Use upper, lower and a number.';
    if (pw.confirm !== pw.next) next.confirm = 'Passwords do not match.';
    setPwErrors(next);
    if (Object.keys(next).length) return;

    setChanging(true);
    try {
      await profileService.changePassword({ currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password changed successfully');
    } catch (err) {
      if (err.errors) setPwErrors(err.errors);
      toast.error(err.message);
    } finally {
      setChanging(false);
    }
  };

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-20">
        <Loader label="Loading profile…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your personal information and account security.
        </p>
      </header>

      {/* Identity card */}
      <section className="card flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center">
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-violet-600 text-2xl font-bold text-white">
          {form.name?.[0]?.toUpperCase() || 'U'}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-slate-900">{form.name}</h2>
          <p className="truncate text-sm text-slate-500">{form.email}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <CalendarDays size={13} />
            Member since{' '}
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString()
              : new Date().toLocaleDateString()}
          </p>
        </div>
        <span className="badge bg-emerald-50 text-emerald-700">
          <ShieldCheck size={13} /> Verified account
        </span>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Edit profile */}
        <form onSubmit={onSave} className="card space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <User size={16} className="text-brand-500" /> Personal information
          </h2>

          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input
              id="name"
              className="input"
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
                setErrors({});
              }}
            />
            {errors.name && <p className="mt-1.5 text-xs text-rose-600">{errors.name}</p>}
          </div>

          <div>
            <label className="label" htmlFor="email">Email address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id="email" className="input pl-10 bg-slate-50 text-slate-500" value={form.email} disabled />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Contact support to change the email on your account.
            </p>
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        {/* Change password */}
        <form onSubmit={onChangePw} className="card space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck size={16} className="text-violet-500" /> Change password
          </h2>

          <div>
            <label className="label" htmlFor="current">Current password</label>
            <input
              id="current"
              type="password"
              className="input"
              autoComplete="current-password"
              value={pw.current}
              onChange={(e) => {
                setPw((p) => ({ ...p, current: e.target.value }));
                setPwErrors({});
              }}
            />
            {pwErrors.current && <p className="mt-1.5 text-xs text-rose-600">{pwErrors.current}</p>}
          </div>

          <div>
            <label className="label" htmlFor="new">New password</label>
            <input
              id="new"
              type="password"
              className="input"
              autoComplete="new-password"
              value={pw.next}
              onChange={(e) => {
                setPw((p) => ({ ...p, next: e.target.value }));
                setPwErrors({});
              }}
            />
            {pwErrors.next && <p className="mt-1.5 text-xs text-rose-600">{pwErrors.next}</p>}
          </div>

          <div>
            <label className="label" htmlFor="confirm">Confirm new password</label>
            <input
              id="confirm"
              type="password"
              className="input"
              autoComplete="new-password"
              value={pw.confirm}
              onChange={(e) => {
                setPw((p) => ({ ...p, confirm: e.target.value }));
                setPwErrors({});
              }}
            />
            {pwErrors.confirm && (
              <p className="mt-1.5 text-xs text-rose-600">{pwErrors.confirm}</p>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={changing}>
            <ShieldCheck size={16} /> {changing ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
