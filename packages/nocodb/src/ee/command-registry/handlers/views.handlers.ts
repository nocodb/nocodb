import {
  ViewDeleteContract,
  ViewUpdateContract,
} from '../operations/views.operations';
import { overrideConflictingViewByTitle } from './view-replay-conflict';
import type { ViewsService } from '~/services/views.service';
import { View } from '~/models';
import { registerForward } from '~/command-registry/replay-context';

export function registerViewHandlers(svc: ViewsService): void {
  registerForward(ViewUpdateContract, async (ctx, p) => {
    const newTitle = p.view?.title?.trim();
    if (newTitle) {
      const target = await View.get(ctx, p.viewId);
      if (target && target.title !== newTitle) {
        await overrideConflictingViewByTitle(
          ctx,
          target.fk_model_id,
          newTitle,
          p.viewId,
        );
      }
    }
    return svc.viewUpdate(ctx, p);
  });
  registerForward(ViewDeleteContract, (ctx, p) =>
    svc.viewDelete(ctx, { ...p, skipTrash: true }),
  );
}
