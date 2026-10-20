// Abuse reports filed by anonymous visitors of public shares.

/** Public surfaces that can be reported. Forms are views, so `SHARED_VIEW` covers them. */
export enum AbuseReportResourceType {
  SHARED_VIEW = 'shared_view',
  INTERFACE = 'interface',
  DASHBOARD = 'dashboard',
  ARTIFACT = 'artifact',
}

export enum AbuseReportReason {
  PHISHING = 'phishing',
  SCAM = 'scam',
  IMPERSONATION = 'impersonation',
  MALWARE = 'malware',
  ILLEGAL_CONTENT = 'illegal_content',
  SPAM = 'spam',
  OTHER = 'other',
}

export enum AbuseReportStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export const ABUSE_REPORT_NAME_MAX_LENGTH = 150;
export const ABUSE_REPORT_EMAIL_MAX_LENGTH = 254;
export const ABUSE_REPORT_DESCRIPTION_MIN_LENGTH = 100;
export const ABUSE_REPORT_DESCRIPTION_MAX_LENGTH = 1000;

// Request body type `AbuseReportReqType` is generated from swagger (Api.ts).

export interface AbuseReportType {
  id: string;
  resource_type: AbuseReportResourceType;
  resource_id: string;
  resource_title?: string;
  fk_workspace_id?: string;
  workspace_title?: string;
  base_id?: string;
  public_url: string;
  reason: AbuseReportReason;
  description: string;
  reporter_name: string;
  reporter_email: string;
  ip?: string;
  user_agent?: string;
  admins_notified?: boolean;
  status: AbuseReportStatus;
  resolved_by?: string | null;
  resolved_at?: string | null;
  resource_disabled_by?: string | null;
  resource_disabled_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Why an account is offered as a block candidate on a report. */
export enum AbuseReportCandidateRole {
  OWNER = 'owner',
  CREATOR = 'creator',
  BASE_OWNER = 'base_owner',
}

export interface AbuseReportBlockCandidate {
  id: string;
  email: string;
  display_name?: string;
  roles: AbuseReportCandidateRole[];
  blocked: boolean;
  /** Super admins can't be blocked from here. */
  is_super_admin: boolean;
}

export interface AbuseReportDetailType extends AbuseReportType {
  /** Whether the reported link still works. */
  resource_shared: boolean;
  candidates: AbuseReportBlockCandidate[];
}

export interface AbuseReportListType {
  list: AbuseReportType[];
  pageInfo: { totalRows: number; page: number; pageSize: number };
  /** Open reports, for the admin menu badge. */
  openCount: number;
}
