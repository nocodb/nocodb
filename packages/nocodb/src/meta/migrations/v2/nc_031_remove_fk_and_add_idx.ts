// import ses from '../../v1-legacy/plugins/ses';
import { MetaTable } from '../../meta.service';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  console.time(MetaTable.BASES);
  await knex.schema.alterTable(MetaTable.BASES, (table) => {
    table.dropForeign('project_id');
    table.index('project_id');
  });
  console.timeEnd(MetaTable.BASES);

  console.time(MetaTable.MODELS);
  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.dropForeign('base_id');
    table.index('base_id');
    table.dropForeign('project_id');
    table.index('project_id');
  });
  console.timeEnd(MetaTable.MODELS);

  console.time(MetaTable.COLUMNS);
  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.dropForeign('fk_model_id');
    table.index('fk_model_id');
  });
  console.timeEnd(MetaTable.COLUMNS);

  console.time(MetaTable.COL_RELATIONS);
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.dropForeign('fk_column_id');
    table.index('fk_column_id');

    table.dropForeign('fk_related_model_id');

    table.dropForeign('fk_child_column_id');

    table.dropForeign('fk_parent_column_id');

    table.dropForeign('fk_mm_model_id');

    table.dropForeign('fk_mm_child_column_id');

    table.dropForeign('fk_mm_parent_column_id');
  });
  console.timeEnd(MetaTable.COL_RELATIONS);

  console.time(MetaTable.COL_SELECT_OPTIONS);
  await knex.schema.alterTable(MetaTable.COL_SELECT_OPTIONS, (table) => {
    table.dropForeign('fk_column_id');
    table.index('fk_column_id');
  });
  console.timeEnd(MetaTable.COL_SELECT_OPTIONS);

  console.time(MetaTable.COL_LOOKUP);
  await knex.schema.alterTable(MetaTable.COL_LOOKUP, (table) => {
    table.dropForeign('fk_column_id');
    table.index('fk_column_id');

    table.dropForeign('fk_relation_column_id');

    table.dropForeign('fk_lookup_column_id');
  });
  console.timeEnd(MetaTable.COL_LOOKUP);

  console.time(MetaTable.COL_QRCODE);
  await knex.schema.alterTable(MetaTable.COL_QRCODE, (table) => {
    table.dropForeign('fk_column_id');
    table.index('fk_column_id');

    table.dropForeign('fk_qr_value_column_id');
  });
  console.timeEnd(MetaTable.COL_QRCODE);

  console.time(MetaTable.COL_BARCODE);
  await knex.schema.alterTable(MetaTable.COL_BARCODE, (table) => {
    table.dropForeign('fk_column_id');
    table.index('fk_column_id');

    table.dropForeign('fk_barcode_value_column_id');
  });
  console.timeEnd(MetaTable.COL_BARCODE);

  console.time(MetaTable.COL_FORMULA);
  await knex.schema.alterTable(MetaTable.COL_FORMULA, (table) => {
    table.dropForeign('fk_column_id');
    table.index('fk_column_id');
  });
  console.timeEnd(MetaTable.COL_FORMULA);

  console.time(MetaTable.COL_ROLLUP);
  await knex.schema.alterTable(MetaTable.COL_ROLLUP, (table) => {
    table.dropForeign('fk_column_id');
    table.index('fk_column_id');

    table.dropForeign('fk_relation_column_id');

    table.dropForeign('fk_rollup_column_id');
  });
  console.timeEnd(MetaTable.COL_ROLLUP);

  console.time(MetaTable.VIEWS);
  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.dropForeign('fk_model_id');
    table.index('fk_model_id');
  });
  console.timeEnd(MetaTable.VIEWS);

  console.time(MetaTable.HOOKS);
  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.dropForeign('fk_model_id');
    table.index('fk_model_id');
  });
  console.timeEnd(MetaTable.HOOKS);

  console.time(MetaTable.FILTER_EXP);
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');

    table.dropForeign('fk_hook_id');
    table.index('fk_hook_id');

    table.dropForeign('fk_column_id');

    table.dropForeign('fk_parent_id');
    table.index('fk_parent_id');
  });
  console.timeEnd(MetaTable.FILTER_EXP);

  console.time(MetaTable.SORT);
  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');

    table.dropForeign('fk_column_id');
    table.index('fk_column_id');
  });
  console.timeEnd(MetaTable.SORT);

  console.time(MetaTable.SHARED_VIEWS);
  await knex.schema.alterTable(MetaTable.SHARED_VIEWS, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');
  });
  console.timeEnd(MetaTable.SHARED_VIEWS);

  console.time(MetaTable.FORM_VIEW);
  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');
  });
  console.timeEnd(MetaTable.FORM_VIEW);

  console.time(MetaTable.FORM_VIEW_COLUMNS);
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');

    table.dropForeign('fk_column_id');
    table.index('fk_column_id');
  });
  console.timeEnd(MetaTable.FORM_VIEW_COLUMNS);

  console.time(MetaTable.GALLERY_VIEW);
  await knex.schema.alterTable(MetaTable.GALLERY_VIEW, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');

    table.dropForeign('fk_cover_image_col_id');
  });
  console.timeEnd(MetaTable.GALLERY_VIEW);

  console.time(MetaTable.GALLERY_VIEW_COLUMNS);
  await knex.schema.alterTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');

    table.dropForeign('fk_column_id');
    table.index('fk_column_id');
  });
  console.timeEnd(MetaTable.GALLERY_VIEW_COLUMNS);

  console.time(MetaTable.GRID_VIEW);
  await knex.schema.alterTable(MetaTable.GRID_VIEW, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');
  });
  console.timeEnd(MetaTable.GRID_VIEW);

  console.time(MetaTable.GRID_VIEW_COLUMNS);
  await knex.schema.alterTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');

    table.dropForeign('fk_column_id');
    table.index('fk_column_id');
  });
  console.timeEnd(MetaTable.GRID_VIEW_COLUMNS);

  console.time(MetaTable.MAP_VIEW);
  await knex.schema.alterTable(MetaTable.MAP_VIEW, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');

    table.dropForeign('fk_geo_data_col_id');
    table.index('fk_geo_data_col_id');

    table.dropForeign('base_id');
    table.dropForeign('project_id');
  });
  console.timeEnd(MetaTable.MAP_VIEW);

  console.time(MetaTable.MAP_VIEW_COLUMNS);
  await knex.schema.alterTable(MetaTable.MAP_VIEW_COLUMNS, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');

    table.dropForeign('fk_column_id');
    table.index('fk_column_id');
  });
  console.timeEnd(MetaTable.MAP_VIEW_COLUMNS);

  console.time(MetaTable.KANBAN_VIEW);
  await knex.schema.alterTable(MetaTable.KANBAN_VIEW, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');

    table.dropForeign('fk_grp_col_id');
    table.index('fk_grp_col_id');

    table.dropForeign('fk_cover_image_col_id');
  });
  console.timeEnd(MetaTable.KANBAN_VIEW);

  console.time(MetaTable.KANBAN_VIEW_COLUMNS);
  await knex.schema.alterTable(MetaTable.KANBAN_VIEW_COLUMNS, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');

    table.dropForeign('fk_column_id');
    table.index('fk_column_id');
  });
  console.timeEnd(MetaTable.KANBAN_VIEW_COLUMNS);

  console.time(MetaTable.PROJECT_USERS);
  await knex.schema.alterTable(MetaTable.PROJECT_USERS, (table) => {
    table.dropForeign('project_id');
    table.index('project_id');

    table.dropForeign('fk_user_id');
    table.index('fk_user_id');
  });
  console.timeEnd(MetaTable.PROJECT_USERS);

  console.time(MetaTable.AUDIT);
  await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
    table.dropForeign('project_id');
    table.index('project_id');

    table.dropForeign('fk_model_id');
    table.index('fk_model_id');
  });
  console.timeEnd(MetaTable.AUDIT);

  console.time(MetaTable.MODEL_ROLE_VISIBILITY);
  await knex.schema.alterTable(MetaTable.MODEL_ROLE_VISIBILITY, (table) => {
    table.dropForeign('fk_view_id');
    table.index('fk_view_id');
  });
  console.timeEnd(MetaTable.MODEL_ROLE_VISIBILITY);

  console.time(MetaTable.SYNC_SOURCE);
  await knex.schema.alterTable(MetaTable.SYNC_SOURCE, (table) => {
    table.dropForeign('project_id');
    table.index('project_id');

    table.dropForeign('base_id');
    table.index('base_id');
  });
  console.timeEnd(MetaTable.SYNC_SOURCE);

  console.time(MetaTable.API_TOKENS);
  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.dropForeign('fk_user_id');
    table.index('fk_user_id');
  });
  console.timeEnd(MetaTable.API_TOKENS);
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.BASES, (table) => {
    table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);
  });

  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.foreign('base_id').references(`${MetaTable.BASES}.id`);
    table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);
  });

  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.foreign('fk_model_id').references(`${MetaTable.MODELS}.id`);
  });

  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
    table.foreign('fk_related_model_id').references(`${MetaTable.MODELS}.id`);
    table.foreign('fk_child_column_id').references(`${MetaTable.COLUMNS}.id`);
    table.foreign('fk_parent_column_id').references(`${MetaTable.COLUMNS}.id`);
    table.foreign('fk_mm_model_id').references(`${MetaTable.MODELS}.id`);
    table
      .foreign('fk_mm_child_column_id')
      .references(`${MetaTable.COLUMNS}.id`);
    table
      .foreign('fk_mm_parent_column_id')
      .references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.COL_SELECT_OPTIONS, (table) => {
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.COL_LOOKUP, (table) => {
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
    table
      .foreign('fk_relation_column_id')
      .references(`${MetaTable.COLUMNS}.id`);
    table.foreign('fk_lookup_column_id').references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.COL_ROLLUP, (table) => {
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
    table
      .foreign('fk_relation_column_id')
      .references(`${MetaTable.COLUMNS}.id`);
    table.foreign('fk_rollup_column_id').references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.COL_QRCODE, (table) => {
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
    table
      .foreign('fk_qr_value_column_id')
      .references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.COL_BARCODE, (table) => {
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
    table
      .foreign('fk_barcode_value_column_id')
      .references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.COL_FORMULA, (table) => {
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.foreign('fk_model_id').references(`${MetaTable.MODELS}.id`);
  });

  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.foreign('fk_model_id').references(`${MetaTable.MODELS}.id`);
  });

  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);
    table.foreign('fk_hook_id').references(`${MetaTable.HOOKS}.id`);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
    table.foreign('fk_parent_id').references(`${MetaTable.FILTER_EXP}.id`);
  });

  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.SHARED_VIEWS, (table) => {
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);
  });

  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);
  });

  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.foreign('fk_view_id').references(`${MetaTable.FORM_VIEW}.fk_view_id`);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.GALLERY_VIEW, (table) => {
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);
    table
      .foreign('fk_cover_image_col_id')
      .references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
    table
      .foreign('fk_view_id')
      .references(`${MetaTable.GALLERY_VIEW}.fk_view_id`);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.GRID_VIEW, (table) => {
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);
  });
  await knex.schema.alterTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
    table.foreign('fk_view_id').references(`${MetaTable.GRID_VIEW}.fk_view_id`);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.MAP_VIEW, (table) => {
    table.string('fk_view_id', 20).primary();
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);
    table.foreign('base_id').references(`${MetaTable.BASES}.id`);
    table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);
    table.foreign('fk_geo_data_col_id').references(`${MetaTable.COLUMNS}.id`);
  });
  await knex.schema.alterTable(MetaTable.MAP_VIEW_COLUMNS, (table) => {
    table.foreign('fk_view_id').references(`${MetaTable.MAP_VIEW}.fk_view_id`);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.KANBAN_VIEW, (table) => {
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);
    table.foreign('fk_grp_col_id').references(`${MetaTable.COLUMNS}.id`);
    table
      .foreign('fk_cover_image_col_id')
      .references(`${MetaTable.COLUMNS}.id`);
  });

  await knex.schema.alterTable(MetaTable.KANBAN_VIEW_COLUMNS, (table) => {
    table
      .foreign('fk_view_id')
      .references(`${MetaTable.KANBAN_VIEW}.fk_view_id`);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
  });
  await knex.schema.alterTable(MetaTable.PROJECT_USERS, (table) => {
    table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);
    table.foreign('fk_user_id').references(`${MetaTable.USERS}.id`);
  });

  await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
    table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);
    table.foreign('fk_model_id').references(`${MetaTable.MODELS}.id`);
  });

  await knex.schema.alterTable(MetaTable.MODEL_ROLE_VISIBILITY, (table) => {
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);
  });

  await knex.schema.alterTable(MetaTable.SYNC_SOURCE, (table) => {
    table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);
  });

  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.foreign('fk_user_id').references(`${MetaTable.USERS}.id`);
    table.foreign('base_id').references(`${MetaTable.BASES}.id`);
  });
};

export { up, down };
