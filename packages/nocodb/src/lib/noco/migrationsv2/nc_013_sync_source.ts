import Knex from 'knex';
import { MetaTable } from '../../utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.SYNC_SOURCE, table => {
    table
      .string('id', 20)
      .primary()
      .notNullable();

    table.string('title');
    table.string('type');
    table.text('details');
    table.boolean('deleted');
    table.boolean('enabled').defaultTo(true);
    table.float('order');

    table.string('project_id', 128);
    table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SYNC_LOGS, table => {
    table
      .string('id', 20)
      .primary()
      .notNullable();

    table.string('project_id', 128);
    table.string('fk_sync_source_id', 20);
    table
      .foreign('fk_sync_source_id')
      .references(`${MetaTable.SYNC_SOURCE}.id`);

    table.integer('time_taken');
    table.string('status');
    table.text('status_details');
    table.text('status_details');

    table.timestamps(true, true);
  });
};

const down = async knex => {
  await knex.schema.dropTable(MetaTable.SYNC_SOURCE);
};

export { up, down };

/**
 * @copyright Copyright (c) 2022, Xgene Cloud Ltd
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
