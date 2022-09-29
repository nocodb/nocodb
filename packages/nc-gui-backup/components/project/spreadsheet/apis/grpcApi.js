export default class GrpcApi {
  constructor(table, ctx) {
    this.table = table
    this.ctx = ctx
  }

  // todo:  - get version letter and use table alias

  async paginatedList(params) {
    const result = await this.ctx.$store.dispatch('sqlMgr/ActSqlOp', [{
      env: this.ctx.nodes.env,
      dbAlias: this.ctx.nodes.dbAlias
    }, 'list', {
      table_name: this.table,
      size: params.limit,
      page: ((params.offset || 0) / (params.limit || 20)) + 1
      // orderBy:
    }])
    return result.data
  }
}
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
