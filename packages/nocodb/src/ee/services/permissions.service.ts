import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  DOCUMENT_PERMISSION_KEYS,
  EventType,
  extractRolesObj,
  getPermissionOptionValue,
  NcBaseError,
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PlanFeatureTypes,
  ProjectRoles,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { Column, Model, Permission, WorkspaceUser } from '~/models';
import { Team } from '~/models';
import Document from '~/ee/models/Document';
import Noco from '~/Noco';
import { NcError } from '~/helpers/ncError';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { CacheDelDirection, CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class PermissionsService {
  protected logger: Logger = new Logger(PermissionsService.name);

  constructor() {}

  /**
   * Assert the requesting user has the required role for the given permission key.
   * Document permissions require creator+; table visibility requires owner.
   */
  protected assertRoleForPermissionKey(
    permissionKey: PermissionKey,
    req: NcRequest,
  ) {
    if (DOCUMENT_PERMISSION_KEYS.includes(permissionKey)) {
      const baseRoles = extractRolesObj(req.user?.base_roles);
      const isCreatorOrAbove =
        baseRoles?.[ProjectRoles.OWNER] || baseRoles?.[ProjectRoles.CREATOR];

      if (!isCreatorOrAbove) {
        const roles = extractRolesObj(req.user?.roles);
        if (
          !roles?.[ProjectRoles.OWNER] &&
          !roles?.[ProjectRoles.CREATOR]
        ) {
          NcError.forbidden(
            'Only base owners and creators can configure document permissions',
          );
        }
      }
    }

    if (permissionKey === PermissionKey.TABLE_VISIBILITY) {
      const baseRoles = extractRolesObj(req.user?.base_roles);
      const isOwner = baseRoles?.[ProjectRoles.OWNER];

      if (!isOwner) {
        const roles = extractRolesObj(req.user?.roles);
        if (!roles?.[ProjectRoles.OWNER]) {
          NcError.forbidden(
            'Only base owners can configure table visibility permissions',
          );
        }
      }
    }
  }

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

    this.assertRoleForPermissionKey(permission_key, req);

    // Enforce plan gating for document permissions
    if (DOCUMENT_PERMISSION_KEYS.includes(permission_key)) {
      await checkForFeature(
        context,
        PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS,
      );
    }

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
      } else if (entity === PermissionEntity.DOCUMENT) {
        const doc = await Document.get(context, entity_id, ncMeta);

        if (!doc) {
          NcError.get(context).genericNotFound('Document', entity_id);
        }

        // Validate restrict-only inheritance: new permission must be
        // at least as restrictive as parent's effective permission
        const newOptionValue = getPermissionOptionValue(
          granted_type,
          granted_role,
        );

        await Permission.validateDocPermissionRestriction(
          context,
          entity_id,
          permission_key,
          newOptionValue,
          ncMeta,
        );

        Object.assign(newPermissionObj, {
          fk_workspace_id: context.workspace_id,
          base_id: context.base_id,
          entity,
          entity_id,
          permission: permission_key,
          granted_type,
          granted_role,
          enforce_for_automation: false,
          enforce_for_form: false,
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

      // Insert new permission users/teams
      if (permission.granted_type === PermissionGrantedType.USER) {
        for (const subject of permissionObj.subjects) {
          if (subject.type === 'user') {
            const permissionUser = await WorkspaceUser.get(
              context.workspace_id,
              subject.id,
              {},
              ncMeta,
            );

            if (!permissionUser) {
              NcError.unprocessableEntity(
                `User with id '${subject.id}' is not part of this workspace`,
              );
            }
          } else if (subject.type === 'team') {
            const team = await Team.get(context, subject.id, ncMeta);

            if (!team) {
              NcError.unprocessableEntity(
                `Team with id '${subject.id}' not found or is deleted`,
              );
            }

            // Verify team belongs to the workspace
            if (team.fk_workspace_id !== context.workspace_id) {
              NcError.unprocessableEntity(
                `Team with id '${subject.id}' does not belong to this workspace`,
              );
            }
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
          context,
          `${CacheScope.PERMISSION}:${existingPermission?.id || permission.id}`,
        );

        // Delete permission users
        await NocoCache.deepDel(
          context,
          `${CacheScope.PERMISSION_USER}:${
            existingPermission?.id || permission.id
          }:list`,
          CacheDelDirection.PARENT_TO_CHILD,
        );
      }
      if (error instanceof NcError || error instanceof NcBaseError) throw error;
      this.logger.error('Failed to set permission', error);
      NcError.get(context).internalServerError('Failed to set permission');
    }

    // Cascade tighten children when a document permission is set
    if (entity === PermissionEntity.DOCUMENT) {
      const newOptionValue = getPermissionOptionValue(
        granted_type,
        granted_role,
      );
      await Permission.cascadeTightenDocPermissions(
        context,
        entity_id,
        permission_key,
        newOptionValue,
      );

      // Clear base permission list cache — cascade may have deleted child permissions
      await Permission.clearBaseCache(context);

      NocoSocket.broadcastEvent(context, {
        event: EventType.META_EVENT,
        payload: {
          action: 'document_permission_update',
          baseId: context.base_id,
          payload: {},
        },
      });
    }

    await this.broadcastPermissionUpdate(context);

    if (permission_key === PermissionKey.TABLE_VISIBILITY) {
      NocoSocket.broadcastEvent(context, {
        event: EventType.META_EVENT,
        payload: {
          action: 'table_permission_update',
          baseId: context.base_id,
          payload: {},
        },
      });
    }

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

    this.assertRoleForPermissionKey(permission_key, req);

    // Enforce plan gating for document permissions
    if (DOCUMENT_PERMISSION_KEYS.includes(permission_key)) {
      await checkForFeature(
        context,
        PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS,
      );
    }

    const permission = await Permission.getByEntity(
      context,
      entity,
      entity_id,
      permission_key,
    );

    // No explicit permission row exists — already at default; nothing to drop
    if (!permission) {
      return;
    }

    const ncMeta = await Noco.ncMeta.startTransaction();

    try {
      await Permission.delete(context, permission.id, ncMeta);

      await ncMeta.commit();
    } catch (error) {
      await ncMeta.rollback();

      // Rollback cache
      // Delete permission
      await NocoCache.del(context, `${CacheScope.PERMISSION}:${permission.id}`);
      // Delete permission users
      await NocoCache.deepDel(
        context,
        `${CacheScope.PERMISSION_USER}:${permission.id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
      // Delete base permissions list
      await NocoCache.deepDel(
        context,
        `${CacheScope.PERMISSION}:${context.base_id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
      if (error instanceof NcError || error instanceof NcBaseError) throw error;
      this.logger.error('Failed to delete permission', error);
      NcError.get(context).internalServerError('Failed to delete permission');
    }

    await this.broadcastPermissionUpdate(context);

    if (DOCUMENT_PERMISSION_KEYS.includes(permission_key)) {
      NocoSocket.broadcastEvent(context, {
        event: EventType.META_EVENT,
        payload: {
          action: 'document_permission_update',
          baseId: context.base_id,
          payload: {},
        },
      });
    }

    if (permission_key === PermissionKey.TABLE_VISIBILITY) {
      NocoSocket.broadcastEvent(context, {
        event: EventType.META_EVENT,
        payload: {
          action: 'table_permission_update',
          baseId: context.base_id,
          payload: {},
        },
      });
    }
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
        context,
        `${CacheScope.PERMISSION}:${context.base_id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
      if (error instanceof NcError || error instanceof NcBaseError) throw error;
      this.logger.error('Failed to delete permissions', error);
      NcError.get(context).internalServerError('Failed to delete permissions');
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

    if (
      oldPermissions.some(
        (p) => p.permission === PermissionKey.TABLE_VISIBILITY,
      )
    ) {
      NocoSocket.broadcastEvent(context, {
        event: EventType.META_EVENT,
        payload: {
          action: 'table_permission_update',
          baseId: context.base_id,
          payload: {},
        },
      });
    }
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
