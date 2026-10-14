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

export interface AbuseReportReqType {
  resource_type: AbuseReportResourceType;
  /** Public share id of the resource, e.g. a shared view's uuid. */
  identifier: string;
  reason: AbuseReportReason;
  name: string;
  email: string;
  description: string;
  /** Honeypot. Left empty by people, filled by bots. */
  website?: string;
}

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
  created_at?: string;
  updated_at?: string;
}
