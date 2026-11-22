export default function Loader({ label = 'Loading…', size = 'md', className = '' }) {
  const ring = size === 'sm' ? 'h-4 w-4 border-2' : size === 'lg' ? 'h-10 w-10 border-[3px]' : 'h-6 w-6 border-2';
  return (
    <div className={`flex items-center justify-center gap-3 text-slate-500 ${className}`}>
      <span
        className={`${ring} animate-spin rounded-full border-brand-500 border-t-transparent`}
        aria-hidden="true"
      />
      {label ? <span className="text-sm font-medium">{label}</span> : null}
    </div>
  );
}

/** Full-page loader used while the auth session is being restored. */
export function PageLoader({ label = 'Loading ConnectMeet…' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Loader label={label} size="lg" />
    </div>
  );
}
