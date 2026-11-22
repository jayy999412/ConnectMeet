import { Link } from 'react-router-dom';

/**
 * Reusable brand wordmark.
 * `as` lets it render as a router <Link>, an <a> or a plain <span>.
 */
export default function Logo({ to = '/', size = 'md', className = '' }) {
  const mark = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl';
  const text = size === 'sm' ? 'text-lg' : 'text-xl';

  const inner = (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span className={`${mark} grid place-items-center bg-gradient-to-br from-brand-600 to-violet-600 shadow-sm`}>
        <svg viewBox="0 0 64 64" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M14 24a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V24z"
            fill="#fff"
          />
          <path d="M40 27.5 50 21v22l-10-6.5v-9z" fill="#fff" />
        </svg>
      </span>
      <span className={`${text} font-extrabold tracking-tight text-slate-900`}>
        Connect<span className="text-brand-600">Meet</span>
      </span>
    </span>
  );

  if (!to) return inner;
  return (
    <Link to={to} aria-label="ConnectMeet home">
      {inner}
    </Link>
  );
}
