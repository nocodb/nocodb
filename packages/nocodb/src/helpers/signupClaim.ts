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
 * Wraps the create branch only. The invite path updates an existing row, and
 * rejecting a concurrent invite acceptance with "User already exist" would be
 * wrong, so callers must keep that branch outside this.
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
