import Knex from 'knex';
import { MetaTable } from '../../utils/globals';

const up = async (knex: Knex) => {
  if (knex.client.config.client !== 'sqlite3') {
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.text('success_msg').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.text('redirect_url').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.text('banner_image_url').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.text('logo_url').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
      table.text('description').alter();
    });
  }
};

const down = async (knex) => {
  if (knex.client.config.client !== 'sqlite3') {
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.string('success_msg').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.string('redirect_url').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.string('banner_image_url').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.string('logo_url').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
      table.string('description').alter();
    });
  }
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
