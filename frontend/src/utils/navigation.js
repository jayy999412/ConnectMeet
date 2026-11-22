/**
 * Post-login redirect helpers.
 *
 * Invite links look like `/join?code=ABCDE-FGHIJ`. A signed-out guest who opens
 * one is bounced to `/login`, so the *entire* path — including the query string
 * carrying the meeting code — must survive the round trip.
 *
 * Two separate mistakes are guarded against here:
 *   1. Using `location.pathname` alone silently drops `?code=...`.
 *   2. Reading only `?next=` ignores the `state.from` that ProtectedRoute sets,
 *      and vice versa. Both sources are accepted.
 *
 * The result is also validated as a same-site path so a crafted
 * `?next=https://evil.example` cannot bounce users off-site after auth.
 */

/** Read the intended destination from router state, then the ?next= query param. */
export function readNextTarget(location, params) {
  const fromState = location?.state?.from;
  const fromQuery = typeof params?.get === 'function' ? params.get('next') : null;
  return fromState || fromQuery || null;
}

/**
 * Return a safe in-app path, or `/dashboard` when the target is missing,
 * absolute, protocol-relative (`//host`), or otherwise off-site.
 */
export function safeNext(target) {
  if (typeof target !== 'string') return '/dashboard';

  const value = target.trim();
  // Must be a relative in-app path. Rejects `https://…`, `//host`, `/\host`.
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/dashboard';
  }
  // Never allow the auth pages themselves as a destination (infinite loop).
  const path = value.split('?')[0].split('#')[0];
  if (path === '/login' || path === '/register' || path === '/forgot-password') {
    return '/dashboard';
  }
  return value;
}

/** Destination for a successful login / registration. */
export function nextAfterAuth(location, params) {
  return safeNext(readNextTarget(location, params));
}

/** Encode a destination as the `?next=` query string for cross-links. */
export function nextQuery(target) {
  const safe = safeNext(target);
  return safe === '/dashboard' ? '' : `?next=${encodeURIComponent(safe)}`;
}
