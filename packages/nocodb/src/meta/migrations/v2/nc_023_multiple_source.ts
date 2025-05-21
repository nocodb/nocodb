import type { Knex } from 'knex';
import { MetaTable, MetaTableOldV2 } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SYNC_SOURCE, (table) => {
    table.string('base_id', 20);
    table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
  });

  await knex.schema.alterTable(MetaTableOldV2.BASES, (table) => {
    table.boolean('enabled').defaultTo(true);
    table.float('order');
  });

  await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
    table.dropForeign('base_id');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.SYNC_SOURCE, (table) => {
    table.dropColumn('base_id');
  });

  await knex.schema.alterTable(MetaTableOldV2.BASES, (table) => {
    table.dropColumn('enabled');
    table.dropColumn('order');
  });

  await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
    table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
  });
};

export { up, down };

/**
 * @copyright Copyright (c) 2022, Xgene Cloud Ltd
 *
 * @author Mert Ersoy <mert@nocodb.com>
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
