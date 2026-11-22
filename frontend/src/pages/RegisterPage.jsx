import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { nextAfterAuth, nextQuery, readNextTarget } from '../utils/navigation.js';

/** Mirrors the backend password policy (min 8, upper, lower, digit). */
export function passwordChecks(password) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
  };
}

export default function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  // Preserve the original destination (e.g. an invite link) across signup.
  const nextTarget = readNextTarget(location, params);

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const checks = passwordChecks(form.password);
  const passwordStrong = Object.values(checks).every(Boolean);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, api: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Please enter your full name.';
    else if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters.';

    if (!form.email.trim()) next.email = 'Please enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = 'Enter a valid email address.';

    if (!form.password) next.password = 'Please choose a password.';
    else if (!passwordStrong)
      next.password = 'Password must be 8+ characters with upper, lower and a number.';

    if (!form.confirm) next.confirm = 'Please confirm your password.';
    else if (form.confirm !== form.password) next.confirm = 'Passwords do not match.';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      toast.success('Account created successfully. Welcome to ConnectMeet!');
      navigate(nextAfterAuth(location, params), { replace: true });
    } catch (err) {
      if (err.errors) setErrors(err.errors);
      setErrors((prev) => ({ ...prev, api: err.message }));
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-7 sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 w-fit">
              <Logo to={null} />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Start hosting and joining meetings in seconds.
            </p>
          </div>

          {errors.api && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errors.api}
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div>
              <label className="label" htmlFor="name">Full name</label>
              <div className="relative">
                <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="name"
                  className="input pl-10"
                  placeholder="Aditi Sharma"
                  autoComplete="name"
                  value={form.name}
                  onChange={set('name')}
                  aria-invalid={Boolean(errors.name)}
                />
              </div>
              {errors.name && <p className="mt-1.5 text-xs text-rose-600">{errors.name}</p>}
            </div>

            <div>
              <label className="label" htmlFor="email">Email address</label>
              <div className="relative">
                <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  className="input pl-10"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={set('email')}
                  aria-invalid={Boolean(errors.email)}
                />
              </div>
              {errors.email && <p className="mt-1.5 text-xs text-rose-600">{errors.email}</p>}
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set('password')}
                  aria-invalid={Boolean(errors.password)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-rose-600">{errors.password}</p>}

              {form.password && (
                <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
                  {[
                    ['length', '8+ characters'],
                    ['upper', 'Uppercase letter'],
                    ['lower', 'Lowercase letter'],
                    ['digit', 'A number'],
                  ].map(([key, label]) => (
                    <li
                      key={key}
                      className={`flex items-center gap-1.5 ${
                        checks[key] ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {checks[key] ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="label" htmlFor="confirm">Confirm password</label>
              <div className="relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="confirm"
                  type={showPw ? 'text' : 'password'}
                  className="input pl-10"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={set('confirm')}
                  aria-invalid={Boolean(errors.confirm)}
                />
              </div>
              {errors.confirm && <p className="mt-1.5 text-xs text-rose-600">{errors.confirm}</p>}
            </div>

            <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link
              to={`/login${nextQuery(nextTarget)}`}
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              Log in
            </Link>
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          By registering you agree to use ConnectMeet responsibly.
        </p>
      </div>
    </div>
  );
}
