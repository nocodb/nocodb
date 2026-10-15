/**
 * The public page on screen that a visitor can report. Each shared surface sets
 * it once its share has loaded, and clears it when a load starts so a failed or
 * private page never inherits the previous target. The shared layout and form
 * footers render the "Report abuse" link from it.
 */
export function useAbuseReportTarget() {
  return useState<AbuseReportTarget | undefined>('abuseReportTarget', () => undefined)
}
