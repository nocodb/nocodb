import Knex from 'knex';
import { MetaTable } from '../../utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.string('fk_user_id', 20);
    table.foreign('fk_user_id').references(`${MetaTable.USERS}.id`);
  });

  await knex.schema.alterTable(MetaTable.SYNC_SOURCE, (table) => {
    table.dropForeign(['fk_user_id']);
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.dropForeign(['fk_user_id']);
    table.dropColumn('fk_user_id');
  });

  await knex.schema.alterTable(MetaTable.SYNC_SOURCE, (table) => {
    table.foreign('fk_user_id').references(`${MetaTable.USERS}.id`);
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
