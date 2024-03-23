import {
  OrgUserRoles,
  ProjectRoles,
  RoleColors,
  RoleDescriptions,
  RoleIcons,
} from 'nocodb-sdk';
import { customAlphabet } from 'nanoid';
import { rolePermissions as rolePermissionsFE } from '../../../../../nc-gui/lib/acl';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import rolePermissionsBE, {
  notAssignedPermissionsBE,
  permissionScopes,
} from '~/utils/acl';
import { rolesLabel } from '~/middlewares/extract-ids/extract-ids.middleware';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.ROLES, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('name');
    table.string('label');
    table.string('color');
    table.string('icon');
    table.string('description');
    table.enu('scope', ['org', 'base']).notNullable();

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.PERMISSIONS, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('name');
    table.string('description');
    table.enu('scope', ['org', 'base', 'all']).notNullable();
    table.enu('type', ['frontend', 'backend', 'all']).notNullable();

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.ROLES_PERMISSIONS, (table) => {
    table.string('id', 20).primary().notNullable();

    table
      .string('fk_role_id')
      .notNullable()
      .references('id')
      .inTable(MetaTable.ROLES)
      .onDelete('cascade');

    table
      .string('fk_permission_id')
      .notNullable()
      .references('id')
      .inTable(MetaTable.PERMISSIONS)
      .onDelete('cascade');

    table.timestamps(true, true);
  });

  const migratedPermissions = [];
  const migratedRolePermissions = [];
  // Add permissions to MetaDB that aren't assigned to any role
  Object.entries(notAssignedPermissionsBE).forEach(([scope, permissions]) => {
    permissions.forEach((permission) => {
      migratedPermissions.push({
        id: `prm${nanoidv2()}`,
        name: permission,
        description: '',
        scope,
        type: 'backend',
      });
    });
  });
  await knex(MetaTable.PERMISSIONS).insert(migratedPermissions);

  const allRoles = { org: OrgUserRoles, base: ProjectRoles };
  const allPermissions = {
    backend: rolePermissionsBE,
    frontend: rolePermissionsFE,
  };

  // Import existing roles to Meta DB
  for (const scope in allRoles) {
    for (const roleTitle in allRoles[scope]) {
      const role = allRoles[scope][roleTitle];
      const includedRole = {
        id: `r${nanoidv2()}`,
        name: role,
        label: rolesLabel[role],
        color: RoleColors[role],
        icon: RoleIcons[role],
        description: RoleDescriptions[role],
        scope,
      };
      await knex(MetaTable.ROLES).insert(includedRole);

      // For superadmin add only one permission "*"
      if (role === 'super') {
        const includedPermission = {
          id: `prm${nanoidv2()}`,
          name: '*',
          description: '',
          scope: 'all',
          type: 'all',
        };
        await knex(MetaTable.PERMISSIONS).insert(includedPermission);
        await knex(MetaTable.ROLES_PERMISSIONS).insert({
          id: `rp${nanoidv2()}`,
          fk_role_id: includedRole?.id,
          fk_permission_id: includedPermission?.id,
        });
      } else {
        for (const type in allPermissions) {
          const rolePermissions = allPermissions[type][role];
          if (!rolePermissions) {
            return false;
          }

          // Handle "exclude" prop in permissions list on backend
          const permissions = rolePermissions?.include || {};
          if (type === 'backend' && rolePermissions?.exclude) {
            [
              ...(permissionScopes[scope] || []),
              ...notAssignedPermissionsBE[scope],
            ]
              .filter(
                (item) => !Object.keys(rolePermissions?.exclude).includes(item),
              )
              .forEach((item) => {
                permissions[item] = true;
              });
          }

          const newPermissions = []; // a list with permissions what aren't in DB yet
          const newRolePermissions = []; // a list with role's permissions
          for (const permission in permissions) {
            // Check if permission is already in MetaDB
            let includedPermission = migratedPermissions.find(
              (item) =>
                item.name === permission &&
                item.type === type &&
                item.scope === scope,
            );

            if (!includedPermission) {
              includedPermission = {
                id: `prm${nanoidv2()}`,
                name: permission,
                description: '',
                scope,
                type,
              };
              newPermissions.push(includedPermission);
              migratedPermissions.push(includedPermission);
            }

            const includedRolePermission = {
              id: `rp${nanoidv2()}`,
              fk_role_id: includedRole?.id,
              fk_permission_id: includedPermission?.id,
            };
            newRolePermissions.push(includedRolePermission);
            migratedRolePermissions.push(includedRolePermission);
          }
          if (newPermissions.length) {
            await knex(MetaTable.PERMISSIONS).insert(newPermissions);
          }
          if (newRolePermissions.length) {
            await knex(MetaTable.ROLES_PERMISSIONS).insert(newRolePermissions);
          }
        }
      }
    }
  }
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.ROLES_PERMISSIONS);
  await knex.schema.dropTable(MetaTable.PERMISSIONS);
  await knex.schema.dropTable(MetaTable.ROLES);
};

export { up, down };
