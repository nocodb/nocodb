import { z } from 'zod';
import isEqual from 'fast-deep-equal';
import type { NcContext } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';

/**
 * Keys a write's paired read returns that the write cannot set.
 *
 * Input schemas are strict, so without these a read-mutate-write round trip
 * fails on the first key the read added. `ignored` keys are dropped unseen
 * (timestamps, computed flags). `immutable` keys are dropped only while they
 * still equal the stored value: a changed one is refused, so an edit to
 * something unwritable never comes back green. `nullable` keys are writable
 * ones the read returns as `null` when unset; the tool's schema must accept
 * null for them, and a null is only let through as an echo of an unset value.
 */
export interface ReadEcho {
  readTool: string;
  ignored?: readonly string[];
  immutable?: readonly string[];
  nullable?: readonly string[];
  /** Where a change to an immutable key belongs instead. */
  hints?: Readonly<Record<string, string>>;
}

/** Bookkeeping every read carries and no write takes. */
export const AUDIT_KEYS = [
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
] as const;

export function readEchoShape(echo: ReadEcho): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const key of echo.ignored ?? []) {
    shape[key] = z
      .unknown()
      .optional()
      .describe(
        `Read-only, returned by ${echo.readTool}. Accepted so its output can ` +
          'be sent back, and ignored.',
      );
  }

  for (const key of echo.immutable ?? []) {
    const hint = echo.hints?.[key];
    shape[key] = z
      .unknown()
      .optional()
      .describe(
        `Read-only, returned by ${echo.readTool}. Send back what you read or ` +
          'omit it; a different value is refused.' +
          (hint ? ` ${hint}` : ''),
      );
  }

  return shape;
}

/** Split the echoed keys off a tool's arguments. */
export function takeReadEcho<T extends Record<string, unknown>>(
  args: T,
  echo: ReadEcho,
): { rest: T; immutable: Record<string, unknown> } {
  const rest = { ...args };
  const immutable: Record<string, unknown> = {};

  for (const key of echo.ignored ?? []) delete rest[key];

  for (const key of echo.immutable ?? []) {
    if (rest[key] !== undefined) immutable[key] = rest[key];
    delete rest[key];
  }

  for (const key of echo.nullable ?? []) {
    if (rest[key] === null) {
      immutable[key] = null;
      delete rest[key];
    }
  }

  return { rest, immutable };
}

function sameValue(sent: unknown, stored: unknown) {
  if (sent === null || stored === null || stored === undefined) {
    return (sent ?? null) === (stored ?? null);
  }
  if (typeof sent !== 'object' || typeof stored !== 'object') {
    // Ids come back as strings on some reads and numbers on others.
    return String(sent) === String(stored);
  }
  // The echo arrived as JSON: drop `undefined` props and stringify Dates.
  return isEqual(sent, JSON.parse(JSON.stringify(stored)));
}

/**
 * Refuse an echoed immutable key whose value differs from the stored one.
 * `loadStored` must return the row in the read tool's own shape, and only runs
 * when something was echoed.
 */
export async function assertImmutableEcho(
  context: NcContext,
  echo: ReadEcho,
  sent: Record<string, unknown>,
  loadStored: () => Promise<object | null | undefined>,
) {
  if (!Object.keys(sent).length) return;

  const stored: Record<string, unknown> = { ...(await loadStored()) };
  const changed = Object.keys(sent).filter(
    (key) => !sameValue(sent[key], stored[key]),
  );

  if (!changed.length) return;

  const nulled = changed.filter((key) => echo.nullable?.includes(key));
  if (nulled.length) {
    NcError.get(context).invalidRequestBody(
      `${nulled.map((key) => `\`${key}\``).join(', ')}: null is accepted ` +
        'only as an echo of an unset value, and this one is set. Omit the ' +
        'key to keep it, or send a new value.',
    );
  }

  const hints = changed
    .map((key) => echo.hints?.[key])
    .filter(Boolean)
    .join(' ');

  NcError.get(context).invalidRequestBody(
    `${changed.map((key) => `\`${key}\``).join(', ')} cannot be changed ` +
      `here — ${changed.length > 1 ? 'they are' : 'it is'} read-only, ` +
      `returned by ${echo.readTool}. Send back the value you read (call ` +
      `${echo.readTool} again if it may have moved on), or omit it.` +
      (hints ? ` ${hints}` : ''),
  );
}
