import Knex from 'knex';

const up = async knex => {
  await knex.schema.table('nc_col_relations_v2', table => {
    table.dropForeign(
      ['fk_child_column_id'],
      'nc_col_relations_v2_fk_child_column_id_foreign'
    );

    table.dropForeign(
      ['fk_parent_column_id'],
      'nc_col_relations_v2_fk_parent_column_id_foreign'
    );

    table.dropForeign(
      ['fk_mm_child_column_id'],
      'nc_col_relations_v2_fk_mm_child_column_id_foreign'
    );

    table.dropForeign(
      ['fk_mm_parent_column_id'],
      'nc_col_relations_v2_fk_mm_parent_column_id_foreign'
    );

    table
      .foreign('fk_child_column_id')
      .references('id')
      .inTable('nc_columns_v2')
      .onDelete('CASCADE')
      .withKeyName('nc_col_relations_v2_fk_child_column_id_foreign');

    table
      .foreign('fk_parent_column_id')
      .references('id')
      .inTable('nc_columns_v2')
      .onDelete('CASCADE')
      .withKeyName('nc_col_relations_v2_fk_parent_column_id_foreign');

    table
      .foreign('fk_mm_child_column_id')
      .references('id')
      .inTable('nc_columns_v2')
      .onDelete('CASCADE')
      .withKeyName('nc_col_relations_v2_fk_mm_child_column_id_foreign');

    table
      .foreign('fk_mm_parent_column_id')
      .references('id')
      .inTable('nc_columns_v2')
      .onDelete('CASCADE')
      .withKeyName('nc_col_relations_v2_fk_mm_parent_column_id_foreign');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.table('nc_col_relations_v2', table => {
    table.dropForeign(
      ['fk_child_column_id'],
      'nc_col_relations_v2_fk_child_column_id_foreign'
    );

    table.dropForeign(
      ['fk_parent_column_id'],
      'nc_col_relations_v2_fk_parent_column_id_foreign'
    );

    table.dropForeign(
      ['fk_mm_child_column_id'],
      'nc_col_relations_v2_fk_mm_child_column_id_foreign'
    );

    table.dropForeign(
      ['fk_mm_parent_column_id'],
      'nc_col_relations_v2_fk_mm_parent_column_id_foreign'
    );

    table
      .foreign('fk_child_column_id')
      .references('id')
      .inTable('nc_columns_v2')
      .withKeyName('nc_col_relations_v2_fk_child_column_id_foreign');

    table
      .foreign('fk_parent_column_id')
      .references('id')
      .inTable('nc_columns_v2')
      .withKeyName('nc_col_relations_v2_fk_parent_column_id_foreign');

    table
      .foreign('fk_mm_child_column_id')
      .references('id')
      .inTable('nc_columns_v2')
      .withKeyName('nc_col_relations_v2_fk_mm_child_column_id_foreign');

    table
      .foreign('fk_mm_parent_column_id')
      .references('id')
      .inTable('nc_columns_v2')
      .withKeyName('nc_col_relations_v2_fk_mm_parent_column_id_foreign');
  });
};

export { up, down };

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */