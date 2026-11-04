import NocoCache from '~/cache/NocoCache';
import { NcError } from '~/helpers/catchError';
import { normalizeEmail } from '~/utils/emailUtils';

// Only has to outlive the re-check + insert below (a few ms). Kept short because
// it is a crash net: if a process dies mid-insert, that one address cannot
// register until the key expires.
const CLAIM_TTL_SECONDS = 10;

const claimKey = (email: string) => `signup_claim:${normalizeEmail(email)}`;

/**
 * Serialise new-account creation for one canonical address.
 *
 * Signup checks whether the address is taken and then inserts, with a bcrypt
 * hash in between — concurrent requests both pass the check and both create an
 * account, defeating the canonical-email dedup.
 *
 * Wraps the create branch only. Invite pre-provisioning must not throw on a
 * lost race, so it uses `findOrCreateUnderSignupClaim` instead.
 *
 * Best-effort: `setIfNotExist` is atomic against Redis and within a single
 * process, but returns true unconditionally when the cache is disabled.
 */
export async function withSignupClaim<T>(
  email: string,
  findExisting: () => Promise<unknown>,
  create: () => Promise<T>,
): Promise<T> {
  const key = claimKey(email);

  const claimed = await NocoCache.setIfNotExist(
    'root',
    key,
    '1',
    CLAIM_TTL_SECONDS,
  );

  // Held only while another signup for this address is mid-insert, so by the
  // time this response lands the address really is taken.
  if (!claimed) {
    NcError.badRequest('User already exist');
  }

  try {
    if (await findExisting()) {
      NcError.badRequest('User already exist');
    }

    return await create();
  } finally {
    // Swallowed: awaiting bare, a Redis blip here would replace an already-created
    // account with a 500, and the retry would hit "User already exist". The TTL
    // releases the claim anyway.
    await NocoCache.del('root', key).catch(() => {});
  }
}

/**
 * Invite-side counterpart of `withSignupClaim`: takes the same claim so a
 * pre-provisioned (blank-password) row cannot race `signup()`, but a loser
 * returns the row that won instead of throwing.
 */
export async function findOrCreateUnderSignupClaim<T>(
  email: string,
  find: () => Promise<T | null | undefined>,
  create: () => Promise<T>,
  { retries = 20, retryDelayMs = 100 } = {},
): Promise<{ value: T; created: boolean }> {
  const existing = await find();
  if (existing) return { value: existing, created: false };

  const key = claimKey(email);

  const claimed = await NocoCache.setIfNotExist(
    'root',
    key,
    '1',
    CLAIM_TTL_SECONDS,
  );

  if (!claimed) {
    // A signup is mid-insert for this address; wait for its row.
    for (let i = 0; i < retries; i++) {
      await new Promise((r) => setTimeout(r, retryDelayMs));
      const winner = await find();
      if (winner) return { value: winner, created: false };
    }
    NcError.badRequest('Unable to invite user right now, please retry');
  }

  try {
    const raced = await find();
    if (raced) return { value: raced, created: false };

    return { value: await create(), created: true };
  } finally {
    await NocoCache.del('root', key).catch(() => {});
  }
}
