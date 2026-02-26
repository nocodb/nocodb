import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CredentialStore, Credential } from './types.js';
import { normalizeEmail, credentialKey } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRED_PATH = resolve(__dirname, '..', '.credentials.json');

// ---------------------------------------------------------------------------
// Read / Write credential store
// ---------------------------------------------------------------------------

export function readCredentialStore(): CredentialStore | null {
  if (!existsSync(CRED_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CRED_PATH, 'utf-8')) as CredentialStore;
  } catch {
    return null;
  }
}

export function writeCredentialStore(store: CredentialStore): void {
  store.updatedAt = new Date().toISOString();
  writeFileSync(CRED_PATH, JSON.stringify(store, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Credential accessors
// ---------------------------------------------------------------------------

/** Get a stored credential by URL + email. Returns null if not found. */
export function getCredential(url: string, email: string): Credential | null {
  const store = readCredentialStore();
  if (!store) return null;
  const key = credentialKey(url, email);
  return store.credentials[key] ?? null;
}

/** Store a credential (from signin/signup). Write-only — used by CLI signin/signup commands. */
export function storeCredential(url: string, email: string, password: string, token: string): void {
  const store = readCredentialStore() || {
    credentials: {},
    updatedAt: new Date().toISOString(),
  };
  const key = credentialKey(url, email);
  store.credentials[key] = { email: normalizeEmail(email), password, token };
  writeCredentialStore(store);
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

/** Re-signin using stored password and update the stored token. */
export async function refreshToken(url: string, email: string): Promise<string> {
  const { signin } = await import('./api.js');
  const cred = getCredential(url, email);
  if (!cred) throw new Error(`No credential for "${email}" at ${url} — cannot refresh.`);

  const res = await signin(url, cred.email, cred.password);
  storeCredential(url, cred.email, cred.password, res.token);
  return res.token;
}

/** Re-signin ALL stored users and update all tokens. Optionally filter by URL. */
export async function refreshAllTokens(url?: string): Promise<Record<string, string>> {
  const { signin } = await import('./api.js');
  const store = readCredentialStore();
  if (!store) throw new Error('No credentials stored. Sign in first.');

  const tokens: Record<string, string> = {};
  for (const [key, cred] of Object.entries(store.credentials)) {
    // If url filter provided, only refresh matching entries
    if (url) {
      // Key format: "host:port|email" — extract the host:port part
      const pipeIdx = key.indexOf('|');
      if (pipeIdx === -1) continue;
      const keyHost = key.slice(0, pipeIdx);
      const parsed = new URL(url);
      const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
      const filterHost = `${parsed.hostname}:${port}`;
      if (keyHost !== filterHost) continue;
    }

    try {
      // Extract URL from key to call signin
      const pipeIdx = key.indexOf('|');
      const keyHost = key.slice(0, pipeIdx);
      // Reconstruct a minimal URL from the key — use http since we don't store protocol
      const signinUrl = url || `http://${keyHost}`;
      const res = await signin(signinUrl, cred.email, cred.password);
      tokens[key] = res.token;
      store.credentials[key] = { ...cred, token: res.token };
    } catch (e) {
      throw new Error(`Failed to refresh ${key}: ${e}`);
    }
  }
  writeCredentialStore(store);
  return tokens;
}
