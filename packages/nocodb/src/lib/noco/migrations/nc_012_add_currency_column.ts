import { MetaTable } from '../../utils/globals';
import Knex from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COL_CURRENCY, table => {
    table
      .string('id', 20)
      .primary()
      .notNullable();

    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.text('currency_locale').defaultTo('en-US');
    table.text('currency_code').defaultTo('USD');

    table.boolean('deleted');
    table.timestamps(true, true);
  });
};

const down = async knex => {
  await knex.schema.dropTable(MetaTable.COL_CURRENCY);
};

export { up, down };

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Mert Ersoy <mertmit99@gmail.com>
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
