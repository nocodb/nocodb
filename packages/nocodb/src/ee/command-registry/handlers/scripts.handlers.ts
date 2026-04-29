import { registerForward } from '~/command-registry/_replay-context';
import {
  ScriptCreateContract,
  ScriptUpdateContract,
  ScriptDeleteContract,
} from '../operations/scripts.operations';
import type { ScriptsService } from 'src/ee/services/scripts.service';

export function registerScriptHandlers(svc: ScriptsService): void {
  registerForward(ScriptCreateContract, (ctx, p) => svc.createScript(ctx, p));
  registerForward(ScriptUpdateContract, (ctx, p) => svc.updateScript(ctx, p));
  registerForward(ScriptDeleteContract, (ctx, p) => svc.deleteScript(ctx, p));
}
