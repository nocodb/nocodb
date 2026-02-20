import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { State, Role } from './types.js';
import { TEST_USERS } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = resolve(__dirname, '..', '.state.json');
const DEFAULT_URL = 'http://localhost:8080';

export function getBaseUrl(): string {
  const state = readState();
  return state?.url || process.env.NOCODB_URL || DEFAULT_URL;
}

export function readState(): State | null {
  if (!existsSync(STATE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export function writeState(state: State): void {
  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

export function getToken(role: Role): string {
  const state = readState();
  if (!state) throw new Error('Not initialized. Run: npx tsx cli.ts init');
  const token = state.tokens[role];
  if (!token) throw new Error(`No token for role "${role}". Run: npx tsx cli.ts init`);
  return token;
}

// Re-signin a role and update the stored token. Called when a 401 is detected.
export async function refreshToken(role: Role): Promise<string> {
  const { signin } = await import('./api.js');
  const user = TEST_USERS[role];
  const res = await signin(user.email, user.password);
  const state = readState();
  if (state) {
    state.tokens[role] = res.token;
    writeState(state);
  }
  return res.token;
}
