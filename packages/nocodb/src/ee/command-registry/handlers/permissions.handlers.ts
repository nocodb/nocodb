import { registerForward } from '~/command-registry/_replay-context';
import {
  PermissionSetContract,
  PermissionDropContract,
} from '../operations/permissions.operations';
import type { PermissionsService } from 'src/ee/services/permissions.service';

export function registerPermissionHandlers(svc: PermissionsService): void {
  registerForward(PermissionSetContract, (ctx, p) => svc.permissionSet(ctx, p));
  registerForward(PermissionDropContract, (ctx, p) => svc.permissionDrop(ctx, p));
}
