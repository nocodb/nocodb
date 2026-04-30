import {
  ExtensionCreateContract,
  ExtensionDeleteContract,
  ExtensionUpdateContract,
} from '../operations/extensions.operations';
import type { ExtensionsService } from '~/services/extensions.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerExtensionHandlers(svc: ExtensionsService): void {
  registerForward(ExtensionCreateContract, (ctx, p) =>
    svc.extensionCreate(ctx, p),
  );
  registerForward(ExtensionUpdateContract, (ctx, p) =>
    svc.extensionUpdate(ctx, p),
  );
  registerForward(ExtensionDeleteContract, (ctx, p) =>
    svc.extensionDelete(ctx, p),
  );
}
