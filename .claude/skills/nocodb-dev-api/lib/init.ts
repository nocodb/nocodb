import type { State, Role } from './types.js';
import { ROLES, TEST_USERS, WORKSPACE_ROLES } from './types.js';
import { readState, writeState, getBaseUrl } from './state.js';
import * as api from './api.js';

const WORKSPACE_TITLE = 'Agent Workspace';

// ---------------------------------------------------------------------------
// Ensure all 5 test users exist (try signin, fallback to signup)
// ---------------------------------------------------------------------------

async function ensureUsers(): Promise<Record<string, string>> {
  const tokens: Record<string, string> = {};
  for (const role of ROLES) {
    const { email, password } = TEST_USERS[role];
    try {
      const res = await api.signin(email, password);
      tokens[role] = res.token;
    } catch {
      try {
        const res = await api.signup(email, password);
        tokens[role] = res.token;
      } catch (e) {
        throw new Error(`Failed to signin/signup ${role} (${email}): ${e}`);
      }
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Ensure "Agent Workspace" exists (find or create)
// ---------------------------------------------------------------------------

async function ensureWorkspace(
  ownerToken: string,
): Promise<{ id: string; title: string }> {
  const { list } = await api.listWorkspaces(ownerToken);
  const existing = list.find((ws) => ws.title === WORKSPACE_TITLE);
  if (existing) return { id: existing.id, title: existing.title };
  const ws = await api.createWorkspace(ownerToken, WORKSPACE_TITLE);
  return { id: ws.id, title: ws.title };
}

// ---------------------------------------------------------------------------
// Ensure non-owner users are invited with correct roles
// ---------------------------------------------------------------------------

async function ensureRoles(
  ownerToken: string,
  wsId: string,
  tokens: Record<string, string>,
): Promise<void> {
  const { list } = await api.listWorkspaceUsers(ownerToken, wsId);
  const invitedEmails = new Set(list.map((u) => u.email));

  for (const role of ROLES) {
    if (role === 'owner') continue;
    const { email } = TEST_USERS[role];
    if (invitedEmails.has(email)) continue;

    try {
      await api.inviteToWorkspace(ownerToken, wsId, email, WORKSPACE_ROLES[role]);
    } catch (e) {
      throw new Error(`Failed to invite ${role} (${email}): ${e}`);
    }

    // Accept by re-signing in as the invited user (refreshes their workspace list)
    try {
      const { email: e, password: p } = TEST_USERS[role];
      const res = await api.signin(e, p);
      tokens[role] = res.token;
    } catch {
      // Token already exists from ensureUsers, invitation will take effect on next use
    }
  }
}

// ---------------------------------------------------------------------------
// Placeholder for sample data — will be filled in later
// ---------------------------------------------------------------------------

export async function ensureSampleData(): Promise<unknown> {
  return { message: 'sample data not yet configured' };
}

// ---------------------------------------------------------------------------
// Main init orchestrator
// ---------------------------------------------------------------------------

export async function init(url?: string): Promise<State> {
  const resolvedUrl = url || process.env.NOCODB_URL || getBaseUrl();

  // Temporarily write state so getBaseUrl() picks up the URL for API calls
  const existingState = readState();
  const state: State = {
    url: resolvedUrl,
    tokens: existingState?.tokens || {},
    workspace: existingState?.workspace || null,
    updatedAt: new Date().toISOString(),
  };
  writeState(state);

  const tokens = await ensureUsers();
  state.tokens = tokens as State['tokens'];
  writeState(state);

  const workspace = await ensureWorkspace(tokens.owner);
  state.workspace = workspace;
  writeState(state);

  await ensureRoles(tokens.owner, workspace.id, tokens);
  state.tokens = tokens as State['tokens'];
  writeState(state);

  return state;
}
