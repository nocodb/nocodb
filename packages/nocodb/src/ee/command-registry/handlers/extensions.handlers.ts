import { registerForward } from '~/command-registry/_replay-context';
import {
  ExtensionCreateContract,
  ExtensionUpdateContract,
  ExtensionDeleteContract,
} from '../operations/extensions.operations';
import type { ExtensionsService } from 'src/ee/services/extensions.service';

export function registerExtensionHandlers(svc: ExtensionsService): void {
  registerForward(ExtensionCreateContract, (ctx, p) => svc.extensionCreate(ctx, p));
  registerForward(ExtensionUpdateContract, (ctx, p) => svc.extensionUpdate(ctx, p));
  registerForward(ExtensionDeleteContract, (ctx, p) => svc.extensionDelete(ctx, p));
}
