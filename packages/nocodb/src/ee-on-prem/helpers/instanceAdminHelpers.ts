import Noco from '~/Noco';
import NocoLicense from '~/NocoLicense';

/**
 * Calculate the number of editors (seat-consuming users) across the entire instance.
 * Delegates to NocoLicense.calculateGlobalSeatCount which handles the full
 * team-aware seat calculation (workspace + base direct roles and team roles).
 */
export async function calculateInstanceEditorCount(
  ncMeta = Noco.ncMeta,
): Promise<number> {
  return NocoLicense.calculateGlobalSeatCount(ncMeta);
}
