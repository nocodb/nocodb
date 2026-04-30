import {
  ViewDeleteContract,
  ViewUpdateContract,
} from '../operations/views.operations';
import type { ViewsService } from '~/services/views.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerViewHandlers(svc: ViewsService): void {
  registerForward(ViewUpdateContract, (ctx, p) => svc.viewUpdate(ctx, p));
  registerForward(ViewDeleteContract, (ctx, p) =>
    svc.viewDelete(ctx, { ...p, skipTrash: true }),
  );
}
