// Any value opts out except an explicit false/0, so NC_DISABLE_TELE=false keeps telemetry on.
export function isTelemetryOptedOut(value = process.env.NC_DISABLE_TELE) {
  return !!value && !['false', '0'].includes(value.trim().toLowerCase());
}
