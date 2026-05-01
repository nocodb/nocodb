import {
  HookCreateContract,
  HookDeleteContract,
  HookUpdateContract,
} from '../operations/hooks.operations';
import type { HooksService } from '~/services/hooks.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerHookHandlers(svc: HooksService): void {
  registerForward(HookCreateContract, (ctx, p) => svc.hookCreate(ctx, p));
  registerForward(HookUpdateContract, (ctx, p) => svc.hookUpdate(ctx, p));
  registerForward(HookDeleteContract, (ctx, p) => svc.hookDelete(ctx, p));
}
