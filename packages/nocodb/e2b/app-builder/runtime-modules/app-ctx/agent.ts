/**
 * @nocodb/app-ctx/agent — transport for the in-app assistant. The UI lives in the
 * app (a platform-owned starter component built from the app's own shadcn
 * primitives, so it inherits the theme); this module is only the wire.
 *
 * EventSource rather than a socket because the published app runs under
 * `connect-src 'self'` and the platform's socket gateway authenticates a CONSOLE
 * token, a realm an app end user does not hold. The two calls are split
 * deliberately: `POST …/_agent/turn` carries the full CSRF triad like an action
 * invoke, while `GET …/_agent/stream` is an `EventSource`, which cannot set
 * headers at all — read-only and, without CORS headers, unreadable cross-site, so
 * same-origin policy is the guard.
 *
 * The split also buys resumption: `EventSource` reconnects and replays
 * `Last-Event-ID`, so a dropped connection loses no work.
 */

import type {
  AppAgentBootstrapResponse,
  AppAgentMessagesResponse,
  AppAgentSessionType,
  AppAgentStreamEvent,
  AppAgentTurnResponse,
} from './agent-types';

// Value re-exports: these are const objects, not TS enums, and the widget
// compares against them at runtime — a type-only re-export would compile
// (agent.d.ts declares them as values) and then fail at bundle time.
export {
  APP_AGENT_MAX_MESSAGE,
  AppAgentMode,
  AppAgentToolStatus,
  AppAgentTurnStatus,
} from './agent-types';

export type {
  AppAgentBootstrapResponse,
  AppAgentMessagesResponse,
  AppAgentContentBlock,
  AppAgentMessageRole,
  AppAgentMessageType,
  AppAgentSessionType,
  AppAgentStreamEvent,
  AppAgentTurnResponse,
} from './agent-types';

declare global {
  interface Window {
    __nc_app_action_url__?: string;
    __nc_app_live__?: boolean;
  }
}

/**
 * The agent routes are siblings of the action invoke URL. Deriving them from the
 * injected action URL keeps the app ignorant of its own id (and of the preview
 * token) — the property `ctx.actions` relies on too.
 *
 * The two hosts inject different shapes, and the agent routes sit alongside the
 * invoke route in BOTH:
 *   live     `/api/v1/app/<appId>`                    -> `<same>/_agent`
 *   preview  `/api/internal/app-preview/<token>/__nc_action`
 *                                                     -> `<parent>/_agent`
 * So a trailing `__nc_action` segment is dropped first; without that the preview
 * build would call `…/__nc_action/_agent`, the invoke route with an action id of
 * `_agent`.
 */
function agentBase(): string | null {
  const actionUrl = window.__nc_app_action_url__;
  if (!actionUrl) return null;
  const trimmed = actionUrl.replace(/\/$/, '');
  const root = trimmed.endsWith('/__nc_action')
    ? trimmed.slice(0, -'/__nc_action'.length)
    : trimmed;
  return `${root}/_agent`;
}

function isLive(): boolean {
  return window.__nc_app_live__ === true;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const base = agentBase();
  if (!base) throw new Error('Assistant is not available');

  const res = await fetch(`${base}/${path}`, {
    method: 'POST',
    credentials: isLive() ? 'include' : 'omit',
    headers: isLive()
      ? { 'content-type': 'application/json', 'x-nc-app-request': '1' }
      : { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;

  if (!res.ok) {
    // 429 comes from the platform throttler, whose body is not the app-error
    // shape — so it needs its own sentence rather than "unavailable".
    throw new Error(
      json?.error?.message ??
        (res.status === 429
          ? 'Too many messages just now — give it a moment.'
          : 'The assistant is unavailable.'),
    );
  }
  return json?.data as T;
}

/** Bootstrap: is there an assistant for this caller, and what has been said. */
export async function loadAgentSession(): Promise<AppAgentBootstrapResponse> {
  const base = agentBase();
  if (!base) return { enabled: false, config: {}, sessions: [], messages: [] };

  const res = await fetch(`${base}/session`, {
    credentials: isLive() ? 'include' : 'omit',
    headers: isLive() ? { 'x-nc-app-request': '1' } : {},
  });
  if (!res.ok) return { enabled: false, config: {}, sessions: [], messages: [] };

  const json = (await res.json().catch(() => null)) as {
    data?: AppAgentBootstrapResponse;
  } | null;
  return json?.data ?? { enabled: false, config: {}, sessions: [], messages: [] };
}

export function sendAgentTurn(input: {
  message: string;
  /** Omit to start a fresh conversation; the response carries the new id. */
  sessionId?: string;
}): Promise<AppAgentTurnResponse> {
  return post<AppAgentTurnResponse>('turn', input);
}

/** Switch conversations — the sidebar picking a thread. */
export async function loadAgentMessages(
  sessionId: string,
): Promise<AppAgentMessagesResponse | null> {
  const base = agentBase();
  if (!base) return null;

  const res = await fetch(
    `${base}/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      credentials: isLive() ? 'include' : 'omit',
      headers: isLive() ? { 'x-nc-app-request': '1' } : {},
    },
  );
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    data?: AppAgentMessagesResponse;
  } | null;
  return json?.data ?? null;
}

export function createAgentSession(): Promise<AppAgentSessionType> {
  return post<AppAgentSessionType>('sessions');
}

export function renameAgentSession(
  sessionId: string,
  title: string,
): Promise<null> {
  return post<null>(`sessions/${encodeURIComponent(sessionId)}/rename`, {
    title,
  });
}

export function deleteAgentSession(sessionId: string): Promise<null> {
  return post<null>(`sessions/${encodeURIComponent(sessionId)}/delete`);
}

export function stopAgentTurn(turnId: string): Promise<{ stopped: boolean }> {
  return post<{ stopped: boolean }>('stop', { turnId });
}

export interface AgentStreamHandle {
  close: () => void;
}

/**
 * Watch a turn.
 *
 * `onEvent` fires per frame in seq order. `onClose` fires once, when the turn
 * reaches a terminal frame — NOT when the connection blips, because
 * `EventSource` reconnects itself and picks up where it left off. That is the
 * whole reason the client does not implement its own retry: doing so would
 * fight the browser's.
 */
export function watchAgentTurn(
  turnId: string,
  handlers: {
    onEvent: (event: AppAgentStreamEvent) => void;
    onClose?: () => void;
    onError?: (message: string) => void;
  },
  opts?: { sinceSeq?: number },
): AgentStreamHandle {
  const base = agentBase();
  if (!base) {
    handlers.onError?.('Assistant is not available');
    return { close: () => undefined };
  }

  const url = new URL(`${base}/stream`, window.location.href);
  url.searchParams.set('turnId', turnId);
  if (opts?.sinceSeq) url.searchParams.set('sinceSeq', String(opts.sinceSeq));

  // Same-origin, so cookies ride along by default; `withCredentials` matters
  // only for the cross-site case, which this never is.
  const source = new EventSource(url.toString(), { withCredentials: isLive() });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    source.close();
  };

  source.onmessage = (ev: MessageEvent<string>) => {
    let frame: AppAgentStreamEvent;
    try {
      frame = JSON.parse(ev.data) as AppAgentStreamEvent;
    } catch {
      return;
    }

    handlers.onEvent(frame);

    // The server ends the response after a terminal frame; closing here as well
    // stops EventSource from treating that end-of-stream as a drop and
    // reconnecting to a finished turn.
    if (frame.type === 'turn_end') {
      close();
      handlers.onClose?.();
    }
  };

  source.onerror = () => {
    // A transient drop is invisible here — EventSource retries on its own and
    // resumes from Last-Event-ID. Only a close we already performed is final.
    if (source.readyState === EventSource.CLOSED && !closed) {
      closed = true;
      handlers.onClose?.();
    }
  };

  return { close };
}
