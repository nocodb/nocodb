import { registerForward } from '~/command-registry/_replay-context';
import {
  HookCreateContract,
  HookUpdateContract,
  HookDeleteContract,
} from '../operations/hooks.operations';
import type { HooksService } from 'src/ee/services/hooks.service';

export function registerHookHandlers(svc: HooksService): void {
  registerForward(HookCreateContract, (ctx, p) => svc.hookCreate(ctx, p));
  registerForward(HookUpdateContract, (ctx, p) => svc.hookUpdate(ctx, p));
  registerForward(HookDeleteContract, (ctx, p) => svc.hookDelete(ctx, p));
}
