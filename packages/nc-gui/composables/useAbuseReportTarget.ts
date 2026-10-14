/**
 * The public page on screen that a visitor can report. Each shared surface sets
 * it once its share has loaded; the shared layout and form footers render the
 * "Report abuse" link from it.
 */
export function useAbuseReportTarget() {
  return useState<AbuseReportTarget | undefined>('abuseReportTarget', () => undefined)
}
