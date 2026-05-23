/**
 * Build a short, user-presentable error string from a thrown error. Strips
 * newlines and clips the length so raw DB-driver messages (e.g. "invalid
 * input syntax for type numeric: \"$500.00\"") render cleanly in a toast.
 *
 * Pulled into its own module so that importing it from a unit test doesn't
 * drag the whole jobs / NestJS module graph along with it.
 */
export function describeRowError(err: unknown): string {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? (err as { message?: unknown }).message
      : undefined;
  if (typeof msg !== 'string' || !msg) return 'Failed to insert row';
  return msg.replace(/\s+/g, ' ').trim().slice(0, 240);
}
