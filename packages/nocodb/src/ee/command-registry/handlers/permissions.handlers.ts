import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  PermissionSetContract,
  PermissionDropContract,
} from '../operations/permissions.operations';
import type { PermissionsService } from 'src/ee/services/permissions.service';

export function registerPermissionHandlers(svc: PermissionsService): void {
  OperationRegistry.register(
    PermissionSetContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.permissionSet(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    PermissionDropContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.permissionDrop(ctx, { ...params, req } as any);
    },
  );
}
