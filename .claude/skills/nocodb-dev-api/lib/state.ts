import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { State, Credential, LegacyState } from './types.js';
import { ROLES, TEST_USERS } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = resolve(__dirname, '..', '.state.json');
const DEFAULT_URL = 'http://localhost:8080';

/** Normalize email: lowercase + trim */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function getBaseUrl(): string {
  const state = readState();
  return state?.url || process.env.NOCODB_URL || DEFAULT_URL;
}

/** Detect legacy state (has `tokens` key instead of `credentials`) and auto-migrate. */
function migrateLegacy(raw: Record<string, unknown>): State {
  const legacy = raw as unknown as LegacyState;
  const credentials: Record<string, Credential> = {};
  let defaultUser: string | null = null;

  if (legacy.tokens) {
    for (const role of ROLES) {
      const token = legacy.tokens[role];
      if (!token) continue;
      const user = TEST_USERS[role];
      const email = normalizeEmail(user.email);
      credentials[email] = { email, password: user.password, token };
      if (role === 'owner') defaultUser = email;
    }
  }

  const state: State = {
    url: legacy.url || DEFAULT_URL,
    credentials,
    defaultUser: defaultUser || (Object.keys(credentials)[0] ?? null),
    workspace: legacy.workspace || null,
    updatedAt: legacy.updatedAt || new Date().toISOString(),
  };

  // Persist the migrated state
  writeState(state);
  return state;
}

export function readState(): State | null {
  if (!existsSync(STATE_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    // Auto-migrate legacy format
    if ('tokens' in raw && !('credentials' in raw)) {
      return migrateLegacy(raw);
    }
    return raw as State;
  } catch {
    return null;
  }
}

export function writeState(state: State): void {
  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

/** Get token for a specific email, or the default user if email is omitted. */
export function getToken(email?: string): string {
  const state = readState();
  if (!state) throw new Error('Not initialized. Run: npx tsx scripts/init.ts or sign in first.');

  const key = email ? normalizeEmail(email) : state.defaultUser;
  if (!key) throw new Error('No default user. Sign in first or pass --as=<email>.');

  const cred = state.credentials[key];
  if (!cred) {
    const available = Object.keys(state.credentials);
    throw new Error(
      `No credential for "${key}". Available: ${available.length ? available.join(', ') : '(none)'}`,
    );
  }
  return cred.token;
}

/** Find which stored credential owns a given JWT. Returns null for unknown tokens. */
export function findCredentialForToken(token: string): Credential | null {
  const state = readState();
  if (!state) return null;
  for (const cred of Object.values(state.credentials)) {
    if (cred.token === token) return cred;
  }
  return null;
}

/** Re-signin using stored password and update the stored token. */
export async function refreshTokenForEmail(email: string): Promise<string> {
  const { signin } = await import('./api.js');
  const state = readState();
  const key = normalizeEmail(email);
  const cred = state?.credentials[key];
  if (!cred) throw new Error(`No credential for "${key}" — cannot refresh.`);

  const res = await signin(cred.email, cred.password);
  if (state) {
    state.credentials[key] = { ...cred, token: res.token };
    writeState(state);
  }
  return res.token;
}

/** Re-signin ALL stored users and update all tokens. */
export async function refreshAllTokens(): Promise<Record<string, string>> {
  const { signin } = await import('./api.js');
  const state = readState();
  if (!state) throw new Error('Not initialized. Run: npx tsx scripts/init.ts or sign in first.');

  const tokens: Record<string, string> = {};
  for (const [email, cred] of Object.entries(state.credentials)) {
    try {
      const res = await signin(cred.email, cred.password);
      tokens[email] = res.token;
      state.credentials[email] = { ...cred, token: res.token };
    } catch (e) {
      throw new Error(`Failed to refresh ${email}: ${e}`);
    }
  }
  writeState(state);
  return tokens;
}

/** Store a credential (from signin/signup) and set it as the default user. */
export function storeCredential(email: string, password: string, token: string): void {
  const state = readState() || {
    url: process.env.NOCODB_URL || DEFAULT_URL,
    credentials: {},
    defaultUser: null,
    workspace: null,
    updatedAt: new Date().toISOString(),
  };

  const key = normalizeEmail(email);
  state.credentials[key] = { email: key, password, token };
  state.defaultUser = key;
  writeState(state);
}
