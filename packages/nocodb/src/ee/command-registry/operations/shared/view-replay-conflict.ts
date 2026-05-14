import type { NcContext } from '~/interface/config';
import { View } from '~/models';

/**
 * Sandbox merge replay can collide with views created directly on the
 * production base while the sandbox was active (personal/collaborative views
 * are still allowed on production). When the sandbox version lands, the CE
 * services' duplicate-title check throws — but the agreed semantic is that
 * the sandbox version wins. So before forwarding to the service, look up any
 * production-side view whose title matches and delete it.
 */
export async function overrideConflictingViewByTitle(
  context: NcContext,
  fk_model_id: string,
  rawTitle: string | undefined,
  excludeViewId?: string,
): Promise<void> {
  const title = rawTitle?.trim();
  if (!title || !fk_model_id) return;

  const existing = await View.getByTitleOrId(context, {
    titleOrId: title,
    fk_model_id,
  });

  if (!existing) return;
  if (existing.title !== title) return;
  if (excludeViewId && existing.id === excludeViewId) return;

  await View.delete(context, existing.id);
}
