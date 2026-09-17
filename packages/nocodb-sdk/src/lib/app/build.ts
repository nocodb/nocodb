import type { ChatContentBlock } from '~/lib/chat';

/**
 * App-build realtime surface.
 *
 * Build turns are CHAT turns: they stream over EventType.CHAT_EVENT to the
 * initiator's user room using the chat vocabulary, attributed to the App Builder
 * persona (`agent: CHAT_AGENT_APP_BUILDER` + `appId` on every payload).
 *
 * The ONE thing left on the dedicated APP_BUILD_EVENT channel is the base-room
 * build-lock broadcast — who is building an app right now — because subscription to
 * that room is CREATOR-gated, which a chat base room is not.
 */

export enum AppBuildAction {
  LOCK = 'lock',
}

export interface AppBuildLockPayload {
  // BaseSocketPayload fields (structural compat — avoids circular dep with realtime)
  timestamp: number;
  socketId?: string;
  // payload fields
  action: AppBuildAction;
  appId: string;
  building?: boolean;
  buildingBy?: string;
  /** The builder's user id — lets a client self-detect "I am the one building". */
  buildingById?: string;
}

/**
 * `getAppBuildState` response — the canvas's resync answer when it has no socket
 * history to rely on: open/reload, reconnect, and the watchdog poll that heals a
 * tab stuck on "Building…" after a missed terminal event.
 */
export interface AppBuildState {
  previewUrl?: string;
  building: boolean;
  buildingBy?: string;
  buildingById?: string;
  /** Paired with `previewUrl`, which carries a freshly minted token on every
   *  call — the client keys its iframe swap on this so the preview reloads once
   *  per completed build, not on every poll. */
  draftSha: string | null;
  lastBuildError?: string | null;
  /** In-flight build turn's accumulated stream, for mid-build refresh-resume.
   *  `lastSeq` = highest journaled seq, so the client can seq-merge the
   *  snapshot with live frames. */
  inFlight?: {
    sessionId: string;
    messageId: string;
    parts: ChatContentBlock[];
    lastSeq: number;
  };
}
