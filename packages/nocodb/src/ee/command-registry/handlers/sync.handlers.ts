import { registerForward } from '~/command-registry/_replay-context';
import {
  SyncCreateContract,
  SyncUpdateContract,
  SyncDeleteContract,
} from '../operations/sync.operations';
import type { SyncService } from 'src/ee/services/sync.service';

export function registerSyncHandlers(svc: SyncService): void {
  registerForward(SyncCreateContract, (ctx, p) => svc.syncCreate(ctx, p));
  registerForward(SyncUpdateContract, (ctx, p) => svc.syncUpdate(ctx, p));
  registerForward(SyncDeleteContract, (ctx, p) => svc.syncDelete(ctx, p));
}
