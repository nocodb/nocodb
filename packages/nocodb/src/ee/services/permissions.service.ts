import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  EventType,
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { Column, Model, Permission, WorkspaceUser } from '~/models';
import Noco from '~/Noco';
import { NcError } from '~/helpers/ncError';
import { CacheDelDirection, CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class PermissionsService {
  protected logger: Logger = new Logger(PermissionsService.name);

  constructor() {}

  async setPermission(
    context: NcContext,
    permissionObj: Pick<
      Permission,
      | 'entity'
      | 'entity_id'
      | 'permission'
      | 'granted_type'
      | 'granted_role'
      | 'enforce_for_automation'
      | 'enforce_for_form'
      | 'subjects'
    >,
    req: NcRequest,
  ) {
    const {
      entity,
      entity_id,
      permission: permission_key,
      granted_type,
      granted_role,
      enforce_for_automation = true,
      enforce_for_form = true,
    } = permissionObj;

    let permission: Permission;

    const existingPermission = await Permission.getByEntity(
      context,
      entity,
      entity_id,
      permission_key,
    );

    if (!Object.values(PermissionKey).includes(permission_key)) {
      NcError.genericNotFound('Permission', permission_key);
    }

    if (!Object.values(PermissionGrantedType).includes(granted_type)) {
      NcError.genericNotFound('PermissionGrantedType', granted_type);
    }

    let permissionEntryCreated = false;

    const ncMeta = await Noco.ncMeta.startTransaction();

    try {
      const newPermissionObj: Partial<Permission> = {};

      if (entity === PermissionEntity.TABLE) {
        const table = await Model.get(context, entity_id, ncMeta);

        if (!table) {
          NcError.tableNotFound(entity_id);
        }

        Object.assign(newPermissionObj, {
          fk_workspace_id: context.workspace_id,
          base_id: context.base_id,
          entity,
          entity_id,
          permission: permission_key,
          granted_type,
          granted_role,
          enforce_for_automation,
          enforce_for_form,
          created_by: req.user.id,
        });
      } else if (entity === PermissionEntity.FIELD) {
        const column = await Column.get(context, {
          colId: entity_id,
        });

        if (!column) {
          NcError.get(context).fieldNotFound(entity_id);
        }

        Object.assign(newPermissionObj, {
          fk_workspace_id: context.workspace_id,
          base_id: context.base_id,
          entity,
          entity_id,
          permission: permission_key,
          granted_type,
          granted_role,
          enforce_for_automation,
          enforce_for_form,
          created_by: req.user.id,
        });
      }

      if (existingPermission) {
        permission = await Permission.update(
          context,
          existingPermission.id,
          newPermissionObj,
          ncMeta,
        );
      } else {
        permission = await Permission.insert(context, newPermissionObj, ncMeta);
        permissionEntryCreated = true;
      }

      // Insert new permission users
      if (permission.granted_type === PermissionGrantedType.USER) {
        for (const subject of permissionObj.subjects) {
          if (subject.type === 'user') {
            const permissionUser = await WorkspaceUser.get(
              context.workspace_id,
              subject.id,
              ncMeta,
            );

            if (!permissionUser) {
              NcError.unprocessableEntity(
                `User with id '${subject.id}' is not part of this workspace`,
              );
            }
          } else if (subject.type === 'group') {
            // TODO implement
            NcError.notImplemented('Group permissions are not implemented yet');
          }
        }

        await Permission.setSubjects(
          context,
          permission.id,
          permissionObj.subjects,
          ncMeta,
        );

        permission.subjects = permissionObj.subjects;
      }

      await ncMeta.commit();
    } catch (error) {
      await ncMeta.rollback();

      // Rollback cache
      if (existingPermission || permission) {
        // Delete permission
        await NocoCache.del(
          `${CacheScope.PERMISSION}:${existingPermission?.id || permission.id}`,
        );

        // Delete permission users
        await NocoCache.deepDel(
          `${CacheScope.PERMISSION_USER}:${
            existingPermission?.id || permission.id
          }:list`,
          CacheDelDirection.PARENT_TO_CHILD,
        );
      }

      this.logger.error(error);

      throw error;
    }

    await this.broadcastPermissionUpdate(context);

    if (permissionEntryCreated) {
      Noco.appHooksService.emit(AppEvents.PERMISSION_CREATE, {
        permission,
        context,
        req,
        user: req.user,
      });
    } else {
      Noco.appHooksService.emit(AppEvents.PERMISSION_UPDATE, {
        permission,
        oldPermission: existingPermission,
        context,
        req,
        user: req.user,
      });
    }

    return permission;
  }

  async dropPermission(
    context: NcContext,
    permissionObj: Partial<Permission>,
    req: NcRequest,
  ) {
    const { entity, entity_id, permission: permission_key } = permissionObj;

    const permission = await Permission.getByEntity(
      context,
      entity,
      entity_id,
      permission_key,
    );

    if (!permission) {
      NcError.genericNotFound('Permission', permission_key);
    }

    const ncMeta = await Noco.ncMeta.startTransaction();

    try {
      await Permission.delete(context, permission.id, ncMeta);

      await ncMeta.commit();
    } catch (error) {
      await ncMeta.rollback();

      // Rollback cache
      // Delete permission
      await NocoCache.del(`${CacheScope.PERMISSION}:${permission.id}`);
      // Delete permission users
      await NocoCache.deepDel(
        `${CacheScope.PERMISSION_USER}:${permission.id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
      // Delete base permissions list
      await NocoCache.deepDel(
        `${CacheScope.PERMISSION}:${context.base_id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );

      throw error;
    }

    await this.broadcastPermissionUpdate(context);

    Noco.appHooksService.emit(AppEvents.PERMISSION_DELETE, {
      permission,
      context,
      req,
      user: req.user,
    });
  }

  async bulkDropPermissions(
    context: NcContext,
    permissionIds: string[],
    req: NcRequest,
  ) {
    if (!permissionIds.length) return;

    const oldPermissions = await Permission.list(context, context.base_id);

    const ncMeta = await Noco.ncMeta.startTransaction();

    try {
      await Permission.bulkDelete(context, permissionIds, ncMeta);

      await ncMeta.commit();
    } catch (error) {
      await ncMeta.rollback();

      // Rollback cache
      // Delete base permissions list
      await NocoCache.deepDel(
        `${CacheScope.PERMISSION}:${context.base_id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );

      throw error;
    }

    const deletedPermissions = oldPermissions.filter(
      (perm) => !perm.id || !permissionIds.includes(perm.id),
    );

    for (const permission of deletedPermissions) {
      Noco.appHooksService.emit(AppEvents.PERMISSION_DELETE, {
        permission,
        context,
        req,
        user: req.user,
      });
    }

    await this.broadcastPermissionUpdate(context);
  }

  async broadcastPermissionUpdate(context: NcContext) {
    const perms = await Permission.list(context, context.base_id);

    NocoSocket.broadcastEvent(context, {
      event: EventType.META_EVENT,
      payload: {
        action: 'permission_update',
        baseId: context.base_id,
        payload: perms,
      },
    });
  }
}
