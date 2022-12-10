import { Knex } from 'knex';
import { MetaTable } from '../../utils/globals'

const up = async (knex: Knex) => {
  await knex.schema.createTable('workspace', (table) => {
    table.string('id', 20).primary();
    table.string('title', 255);
    table.text('description');

    table.text('meta');

    // todo: set fk
    table.string('fk_user_id', 20);

    table.boolean('deleted').defaultTo(false);
    table.timestamp('deleted_at');
    table.float('order');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('workspace_user', (table) => {
    // todo: set fk
    table.string('fk_workspace_id', 20);
    table.string('fk_user_id', 20);


    table.string('roles', 255);


    table.boolean('deleted').defaultTo(false);
    table.timestamp('deleted_at');
    table.float('order');
    table.timestamps(true, true);
  });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    // todo: set fk
    table.string('fk_workspace_id', 20);
  });
};

const down = async (knex) => {};

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
