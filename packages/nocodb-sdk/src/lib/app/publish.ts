export interface PublishWarning {
  routineName: string;
  kind: 'ungated_write';
}

export interface PublishOk {
  ok: true;
  versionNumber: number;
  versionId: string;
  /** true when draft sha already equals the live version's sha (no-op republish) */
  alreadyLive?: boolean;
  pinnedRoutines: string[];
  warnings: PublishWarning[];
}

export interface PublishFail {
  ok: false;
  missingRoutines?: string[];
  ungrantedRoutines?: {
    routineName: string;
    integrationId: string;
    integrationTitle: string;
  }[];
  buildIncomplete?: boolean;
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
