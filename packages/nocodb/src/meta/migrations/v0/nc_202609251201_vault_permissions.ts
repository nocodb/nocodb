import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Who may reference a vault. Not in `nc_permissions`, which is keyed by
 * `base_id`; a vault has no base. Dual-scoped like `nc_vaults`.
 */
const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.VAULT_PERMISSIONS, (table) => {
    table.string('id', 20).primary();

    // Owning scope, denormalised so the scope delete cascade finds these rows.
    table.string('fk_workspace_id', 20);
    table.string('fk_org_id', 20);

    table.string('fk_vault_id', 20).notNullable();

    // A `PermissionKey`; only VAULT_REFERENCE today.
    table.string('permission', 255).notNullable();

    // `role` | `user` | `nobody`, matching PermissionGrantedType.
    table.string('granted_type', 255);
    // When granted_type is `role`: this role AND ABOVE may reference.
    table.string('granted_role', 255);

    table.string('created_by', 20);
    table.timestamps(true, true);

    table.unique(['fk_vault_id', 'permission'], {
      indexName: 'nc_vault_permissions_vault_permission_unique',
    });
    table.index(['fk_vault_id'], 'nc_vault_permissions_vault_index');
  });

  await knex.schema.createTable(
    MetaTable.VAULT_PERMISSION_SUBJECTS,
    (table) => {
      table.string('fk_vault_permission_id', 20).notNullable();

      // `user` | `team` | `agent`, matching SubjectType.
      table.string('subject_type', 255).notNullable();
      table.string('subject_id', 255).notNullable();

      // Teams only: `self_only` | `self_and_descendants`.
      table.string('hierarchy_scope', 255);

      table.timestamps(true, true);

      table.primary(['fk_vault_permission_id', 'subject_type', 'subject_id'], {
        constraintName: 'nc_vault_permission_subjects_pkey',
      });
      table.index(
        ['fk_vault_permission_id'],
        'nc_vault_permission_subjects_permission_index',
      );
    },
  );
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.VAULT_PERMISSION_SUBJECTS);
  await knex.schema.dropTable(MetaTable.VAULT_PERMISSIONS);
};

export { up, down };
