/**
 * Normalise whatever a recipient pastes into the Meeting ID field.
 *
 * The join page explicitly invites people to "paste the invite link", so a full
 * URL must resolve to the same thing as typing the bare code:
 *
 *   https://meet.example.com/join?code=ABCDE-FGHIJ  -> ABCDE-FGHIJ
 *   http://localhost:5173/join?code=ABCDE-FGHIJ     -> ABCDE-FGHIJ
 *   ?code=ABCDE-FGHIJ                               -> ABCDE-FGHIJ
 *   ABCDE-FGHIJ                                     -> ABCDE-FGHIJ
 *
 * Without this the whole URL was uppercased and sent to the API, which 404'd.
 */

/** Meeting codes are 5 + '-' + 5 from the configured alphabet (no I/O/0/1). */
const CODE_PATTERN = /([A-Z0-9]{5}-[A-Z0-9]{5})/;

export function normalizeMeetingCode(raw) {
  if (typeof raw !== 'string') return '';
  const input = raw.trim();
  if (!input) return '';

  // 1. A parseable absolute URL — read ?code= directly.
  try {
    const url = new URL(input);
    const fromQuery = url.searchParams.get('code');
    if (fromQuery) return fromQuery.trim().toUpperCase();
  } catch {
    // Not an absolute URL; keep going.
  }

  // 2. A query string without an origin, e.g. "?code=ABCDE-FGHIJ".
  const loose = /[?&]code=([A-Za-z0-9-]+)/i.exec(input);
  if (loose) return loose[1].toUpperCase();

  // 3. A bare code embedded anywhere in the pasted text.
  const match = input.toUpperCase().match(CODE_PATTERN);
  if (match) return match[1];

  // 4. Nothing recognised — pass through uppercased so the backend can return
  //    its normal "meeting not found" message rather than failing silently.
  return input.toUpperCase();
}

/** True when the value already looks like a well-formed meeting code. */
export function isMeetingCode(raw) {
  return CODE_PATTERN.test(String(raw || '').trim().toUpperCase());
}
