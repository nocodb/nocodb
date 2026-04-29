import {
  SyncCreateContract,
  SyncDeleteContract,
  SyncUpdateContract,
} from '../operations/sync.operations';
import type { SyncService } from '~/services/sync.service';
import { registerForward } from '~/command-registry/_replay-context';

export function registerSyncHandlers(svc: SyncService): void {
  registerForward(SyncCreateContract, (ctx, p) => svc.syncCreate(ctx, p));
  registerForward(SyncUpdateContract, (ctx, p) => svc.syncUpdate(ctx, p));
  registerForward(SyncDeleteContract, (ctx, p) => svc.syncDelete(ctx, p));
}
