/**
 * Ephemeral co-editing kill switch. Opt-IN (unlike docs realtime, which is
 * opt-out) because this replaces working single-writer behaviour on the script,
 * Long Text and SmartText editors — a bad rollout must be disableable without a
 * code change. The asymmetry is deliberate; don't "fix" it.
 *
 * Lives in its own leaf module rather than dbHelpers: the coherence gate needs
 * it, and dbHelpers imports the `~/models` barrel, so reaching it from the
 * socket layer creates a load-time cycle ("Cannot access '_BaseUser' before
 * initialization"). Re-exported from dbHelpers for existing callers.
 */
export function isCollabRealtimeEnabled() {
  return process.env.NC_COLLAB_REALTIME === 'true';
}
