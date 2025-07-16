import { Injectable, Logger } from '@nestjs/common';
import {
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
          NcError.fieldNotFound(entity_id);
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

    return permission;
  }

  async dropPermission(context: NcContext, permissionObj: Partial<Permission>) {
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
  }

  async dropAllPermissions(
    context: NcContext,
    permissionObj: Partial<{
      entities: PermissionEntity[];
      modelId?: string; // If modelId is provided, then delete all permissions for the model + field permissions if included in entities
    }>,
  ) {
    const { entities = [], modelId } = permissionObj;

    let model: Model;

    if (modelId) {
      model = await Model.get(context, modelId);

      if (!model) {
        NcError.tableNotFound(modelId);
      }

      await model.getColumns(context);
    }

    return await Permission.deleteAll(
      context,
      context.base_id,
      entities,
      model,
    );
  }
}
