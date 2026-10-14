import { AbuseReportReason } from 'nocodb-sdk';

export const ABUSE_REASON_LABELS: Record<AbuseReportReason, string> = {
  [AbuseReportReason.PHISHING]: 'Phishing / credential harvesting',
  [AbuseReportReason.SCAM]: 'Scam or fraud',
  [AbuseReportReason.IMPERSONATION]: 'Impersonation',
  [AbuseReportReason.MALWARE]: 'Malware or harmful links',
  [AbuseReportReason.ILLEGAL_CONTENT]: 'Illegal content',
  [AbuseReportReason.SPAM]: 'Spam',
  [AbuseReportReason.OTHER]: 'Other',
};

export const truncate = (value: string | undefined, max: number) => {
  const v = (value ?? '').trim();
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
};

/** Makes URLs and domains non-clickable for mail clients: `hxxps://evil[.]com`. */
export const defang = (value: string | undefined) =>
  (value ?? '')
    .replace(/\bhttp(s?):\/\//gi, 'hxxp$1://')
    .replace(/\b([a-z0-9-]+)\.(?=[a-z0-9-]+\b)/gi, '$1[.]');
