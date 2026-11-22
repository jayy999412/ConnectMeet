import { Link } from 'react-router-dom';
import { KeyRound, ShieldCheck, MailWarning, ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo.jsx';

/**
 * Honest password-recovery page.
 *
 * ConnectMeet stores passwords as salted hashes and ships without an email
 * service, so there is no way to email you a reset link. This page explains
 * that plainly instead of showing a form that pretends to send one.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-7 sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 w-fit">
              <Logo to={null} />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Reset your password</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              How account recovery works on this deployment.
            </p>
          </div>

          <div className="space-y-4 text-sm text-slate-600">
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <MailWarning size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="leading-relaxed">
                <span className="font-semibold text-amber-800">No reset emails are sent.</span>{' '}
                This deployment runs without an email service, so a "forgot password" email cannot
                be delivered. No form is shown here because submitting one would do nothing.
              </p>
            </div>

            <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-slate-500" />
              <p className="leading-relaxed">
                Passwords are stored only as salted hashes. Not even the server operator can read a
                password back, which is why there is no "reveal my password" option either.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 flex items-center gap-2 font-semibold text-slate-800">
                <KeyRound size={16} className="text-brand-600" /> What you can do
              </p>
              <ul className="list-inside list-disc space-y-1.5 text-slate-600">
                <li>Try your usual passwords — you may already be signed in on this device.</li>
                <li>
                  Create a new account with the same email only if this one is a throwaway test
                  account.
                </li>
                <li>
                  If you use ConnectMeet through a team deployment, ask the person who runs it to
                  reset your account in the database.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Link to="/login" className="btn-primary w-full py-3">
              <ArrowLeft size={16} /> Back to login
            </Link>
            <Link to="/register" className="btn-secondary w-full py-3 text-center">
              Create a new account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
