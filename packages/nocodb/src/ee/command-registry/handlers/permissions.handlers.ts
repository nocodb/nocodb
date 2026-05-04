import {
  PermissionBulkDropContract,
  PermissionBulkRestoreContract,
  PermissionDropContract,
  PermissionSetContract,
} from '../operations/permissions.operations';
import type {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
} from 'nocodb-sdk';
import type { PermissionsService } from '~/ee/services/permissions.service';
import { Permission } from '~/models';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';

interface SnapshottedPermission {
  entity: PermissionEntity;
  entity_id: string;
  permission: PermissionKey;
  granted_type: PermissionGrantedType;
  granted_role?: PermissionRole | null;
  enforce_for_automation?: boolean;
  enforce_for_form?: boolean;
  subjects?: Array<{
    type: 'user' | 'team';
    id: string;
    hierarchy_scope?: 'self_only' | 'self_and_descendants';
  }>;
}

export function registerPermissionHandlers(svc: PermissionsService): void {
  registerForward(PermissionSetContract, (ctx, p) => svc.setPermission(ctx, p));
  registerForward(PermissionDropContract, (ctx, p) =>
    svc.dropPermission(ctx, p),
  );

  OperationRegistry.register(
    PermissionBulkDropContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      let permissionIds = params.permissionIds ?? [];
      if (params.permissions?.length) {
        const all = await Permission.list(ctx, ctx.base_id);
        permissionIds = params.permissions
          .map(
            (t) =>
              all.find(
                (p) =>
                  p.entity === t.entity &&
                  p.entity_id === t.entity_id &&
                  p.permission === t.permission,
              )?.id,
          )
          .filter((id): id is string => !!id);
      }
      return svc.bulkDropPermissions(ctx, { permissionIds, req });
    },
  );

  OperationRegistry.register(
    PermissionBulkRestoreContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      const perms = params.permissions as SnapshottedPermission[];
      for (const perm of perms) {
        await svc.setPermission(ctx, {
          entity: perm.entity,
          entity_id: perm.entity_id,
          permission: perm.permission,
          granted_type: perm.granted_type,
          granted_role: perm.granted_role ?? undefined,
          enforce_for_automation: perm.enforce_for_automation ?? true,
          enforce_for_form: perm.enforce_for_form ?? true,
          subjects: perm.subjects,
          req,
        });
      }
    },
  );
}
