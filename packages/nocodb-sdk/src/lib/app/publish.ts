export interface PublishWarning {
  routineName: string;
  /**
   * `ungated_write` — a NocoDB-data write routine with no obvious role gate.
   * `unreachable_routine` — a referenced routine listed by no page, so it is
   *   reachable by nobody (except owner) under page-derived grants.
   */
  kind: 'ungated_write' | 'unreachable_routine';
}

export interface PublishOk {
  ok: true;
  versionNumber: number;
  versionId: string;
  /** true when draft sha already equals the live version's sha (no-op republish) */
  alreadyLive?: boolean;
  pinnedRoutines: string[];
  /** page ids frozen into this version's manifest (empty for pageless apps) */
  pinnedPages: string[];
  warnings: PublishWarning[];
}

export interface AppInvalidPage {
  pageId: string;
  /**
   * `unknown_routine` — the page lists a routine name that the app doesn't
   *   reference / define.
   * `duplicate_id` — two pages share the same id.
   * `duplicate_path` — two pages share the same path.
   */
  kind: 'unknown_routine' | 'duplicate_id' | 'duplicate_path';
  detail?: string;
}

export interface PublishFail {
  ok: false;
  missingRoutines?: string[];
  ungrantedRoutines?: {
    routineName: string;
    integrationId: string;
    integrationTitle: string;
  }[];
  /** page-manifest validation failures (Phase 1a pages) */
  invalidPages?: AppInvalidPage[];
  buildIncomplete?: boolean;
  missingComponents?: string[];
  noPages?: boolean;
}

export type PublishResult = PublishOk | PublishFail;

export interface AppVersionSummary {
  versionId: string;
  versionNumber: number;
  gitShaShort: string;
  createdBy: string;
  createdAt: string;
  isLive: boolean;
}

export interface AppLiveSession {
  url: string;
}
