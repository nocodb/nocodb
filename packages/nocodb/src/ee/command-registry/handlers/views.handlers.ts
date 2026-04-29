import { registerForward } from '~/command-registry/_replay-context';
import {
  ViewUpdateContract,
  ViewDeleteContract,
  ShareViewContract,
  ShareViewUpdateContract,
  ShareViewDeleteContract,
} from '../operations/views.operations';
import type { ViewsService } from 'src/ee/services/views.service';

export function registerViewHandlers(svc: ViewsService): void {
  registerForward(ViewUpdateContract, (ctx, p) => svc.viewUpdate(ctx, p));
  registerForward(ViewDeleteContract, (ctx, p) => svc.viewDelete(ctx, p));
  registerForward(ShareViewContract, (ctx, p) => svc.shareView(ctx, p));
  registerForward(ShareViewUpdateContract, (ctx, p) => svc.shareViewUpdate(ctx, p));
  registerForward(ShareViewDeleteContract, (ctx, p) => svc.shareViewDelete(ctx, p));
}
