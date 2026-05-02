import {
  ScriptCreateContract,
  ScriptDeleteContract,
  ScriptUpdateContract,
} from '../operations/scripts.operations';
import type { ScriptsService } from '~/services/scripts.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerScriptHandlers(svc: ScriptsService): void {
  registerForward(ScriptCreateContract, (ctx, p) => svc.createScript(ctx, p));
  registerForward(ScriptUpdateContract, (ctx, p) => svc.updateScript(ctx, p));
  registerForward(ScriptDeleteContract, (ctx, p) => svc.deleteScript(ctx, p));
}
