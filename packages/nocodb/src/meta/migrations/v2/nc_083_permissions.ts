import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.PERMISSIONS, (table) => {
    table.string('id', 20).primary();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);

    table.string('entity', 255); // table, column etc.
    table.string('entity_id', 255); // table id, column id etc.

    table.string('permission', 255); // TABLE_RECORD_ADD, TABLE_RECORD_DELETE, FIELD_EDIT etc.

    table.string('created_by', 20); // user id

    table.boolean('enforce_for_form').defaultTo(true);
    table.boolean('enforce_for_automation').defaultTo(true);

    table.string('granted_type', 255); // role, user, no_one

    // if granted_type is role, granted_role and above can use
    table.string('granted_role', 255); // editor, creator

    table.timestamps(true, true);

    table.index(['base_id', 'fk_workspace_id'], 'nc_permissions_context');
    table.index(['entity', 'entity_id', 'permission'], 'nc_permissions_entity');
  });

  await knex.schema.createTable(MetaTable.PERMISSION_SUBJECTS, (table) => {
    table.string('fk_permission_id', 20);
    table.string('subject_type', 255); // user, group
    table.string('subject_id', 255); // user id, group id

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);

    table.timestamps(true, true);

    table.primary(['fk_permission_id', 'subject_type', 'subject_id']);
    table.index(
      ['fk_workspace_id', 'base_id'],
      'nc_permission_subjects_context',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.PERMISSIONS);
  await knex.schema.dropTable(MetaTable.PERMISSION_SUBJECTS);
};

export { up, down };
