import {
  PermissionDropContract,
  PermissionSetContract,
} from '../operations/permissions.operations';
import type { PermissionsService } from '~/services/permissions.service';
import { registerForward } from '~/command-registry/_replay-context';

export function registerPermissionHandlers(svc: PermissionsService): void {
  registerForward(PermissionSetContract, (ctx, p) => svc.permissionSet(ctx, p));
  registerForward(PermissionDropContract, (ctx, p) =>
    svc.permissionDrop(ctx, p),
  );
}
