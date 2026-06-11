import type { NcContext } from 'nocodb-sdk';

/**
 * CE stub. Personal views are an EE concept — CE never has
 * `lock_type=Personal` flowing through, so this is a no-op.
 *
 * EE build resolves `~/helpers/checkPersonalViewFeature` to the
 * EE override at `src/ee/helpers/checkPersonalViewFeature.ts`
 * which gates on `FEATURE_PERSONAL_VIEWS`.
 *
 * `lockType` is typed as `string` because call sites pass
 * `param.view.lock_type` straight from swagger-generated request
 * types, which emit raw string literals rather than the
 * `ViewLockType` enum. The EE override does an exact string
 * comparison, so widening here avoids per-call-site casts.
 */
export async function assertPersonalViewAllowed(
  _context: NcContext,
  _lockType?: string,
) {
  // no-op in CE
}
