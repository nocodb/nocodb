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
