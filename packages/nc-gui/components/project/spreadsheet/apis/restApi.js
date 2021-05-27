export default class RestApi {

  constructor(table, $ctx) {
    this.table = table;
    this.$ctx = $ctx;
  }

  // todo:  - get version letter and use table alias
  async list(params) {
    const data = await this.get(`/nc/${this.$ctx.$route.params.project_id}/api/v1/${this.table}`, params);
// data.headers['xc-db-response'];

    return data.data;
  }

  async read(id) {
    const data = await this.get(`/nc/${this.$ctx.$route.params.project_id}/api/v1/${this.table}/${id}`);
    return data.data;
  }

  async count(params) {
    const data = await this.get(`/nc/${this.$ctx.$route.params.project_id}/api/v1/${this.table}/count`, params);
    return data.data;
  }


  get(url, params) {
    return this.$axios({
      url,
      params,
      baseURL: process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:8080/'
    })
  }


  async paginatedList(params) {
    // const list = await this.list(params);
    // const count = (await this.count({where: params.where || ''})).count;
    const [list, {count}] = await Promise.all([this.list(params), this.count({where: params.where || ''})]);
    return {list, count};
  }

  async update(id, data, oldData) {
    const res = await this.$axios({
      method: 'put',
      url: `/nc/${this.$ctx.$route.params.project_id}/api/v1/${this.table}/${id}`,
      data,
      baseURL: process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:8080/'
    });
    const colName = Object.keys(data)[0];
    this.$ctx.$store.dispatch('sqlMgr/ActSqlOp', [{dbAlias: this.$ctx.nodes.dbAlias}, 'xcAuditCreate', {
      tn: this.table,
      cn: colName,
      pk: id,
      value: data[colName],
      prevValue: oldData[colName]
    }])

    return res;
  }

  async insert(data) {
    return (await this.$axios({
      method: 'post',
      url: `/nc/${this.$ctx.$route.params.project_id}/api/v1/${this.table}`,
      data,
      baseURL: process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:8080/'
    })).data;
  }

  async delete(id) {
    return this.$axios({
      method: 'delete',
      url: `/nc/${this.$ctx.$route.params.project_id}/api/v1/${this.table}/${id}`,
      baseURL: process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:8080/'
    })
  }


  get $axios() {
    return this.$ctx.$axios;
  }

  get apiUrl() {
    return `${process.env.NODE_ENV === 'production' ?
      `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`
      : 'http://localhost:8080'}/nc/${this.$ctx.$route.params.project_id}/api/v1/${this.table}`
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
