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
    // Invisible characters can split a domain without breaking it.
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
    // Full stops browsers accept as a domain dot.
    .replace(/[\u3002\uFF0E\uFF61]/g, '.')
    .replace(/\bhttp(s?):\/\//gi, 'hxxp$1://')
    // Labels in any script, so IDN domains are defanged too.
    .replace(
      /(?<![\p{L}\p{N}_-])([\p{L}\p{N}_-]+)\.(?=[\p{L}\p{N}_-])/gu,
      '$1[.]',
    );
