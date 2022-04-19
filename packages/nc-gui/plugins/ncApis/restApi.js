export default class RestApi {
  constructor(table, $ctx) {
    this.$ctx = $ctx
    this.table = $ctx.$store.state.meta.metas[table].title
  }

  // todo:  - get version letter and use table alias
  async list(params) {
    // const data = await this.get(`/nc/${this.$ctx.projectId}/api/v1/${this.table}`, params)
    const data = await this.get(`/nc/${this.$ctx.projectId}/api/v1/${this.table}`, params)
    return data.data
  }

  async read(id, params = {}) {
    const data = await this.get(`/nc/${this.$ctx.projectId}/api/v1/${this.table}/${encodeURIComponent(id)}`, params)
    return data.data
  }

  async count(params) {
    if (this.timeout) {
      return this.timeout
    }
    try {
      const data = await this.get(`/nc/${this.$ctx.projectId}/api/v1/${this.table}/count`, params, {
        timeout: 10000
      })
      return data && data.data
    } catch (e) {
      if (e.code === 'ECONNABORTED') {
        // eslint-disable-next-line no-return-assign
        return this.timeout = { count: Infinity }
      } else {
        throw e
      }
    }
  }

  get(url, params = {}, extras = {}) {
    return this.$axios({
      url,
      params,
      ...extras
    })
  }

  async paginatedList(params) {
    // const list = await this.list(params);
    // const count = (await this.count({where: params.where || ''})).count;
    const [list, { count }] = await Promise.all([this.list(params), this.count({
      where: params.where || '',
      conditionGraph: params.conditionGraph
    })])
    return { list, count }
  }

  async paginatedM2mNotChildrenList(params, assoc, pid) {
    /// api/v1/Film/m2mNotChildren/film_actor/44
    // const list = await this.list(params);
    // const count = (await this.count({where: params.where || ''})).count;
    const {
      list,
      info: { count }
    } = (await this.get(`/nc/${this.$ctx.projectId}/api/v1/${this.table}/m2mNotChildren/${assoc}/${pid}`, params)).data
    return { list, count }
  }

  async update(id, data, oldData, cellSaved = true) {
    const res = await this.$axios({
      method: 'put',
      url: `/nc/${this.$ctx.projectId}/api/v1/${this.table}/${encodeURIComponent(id)}`,
      data,
      params: { ignoreWebhook: !cellSaved }
    })
    return res.data
  }

  async insert(data, {
    params = {}
  } = {}) {
    return (await this.$axios({
      method: 'post',
      url: `/nc/${this.$ctx.projectId}/api/v1/${this.table}`,
      data,
      params
    })).data
  }

  async insertBulk(data, {
    params = {}
  } = {}) {
    return (await this.$axios({
      method: 'post',
      url: `/nc/${this.$ctx.projectId}/api/v1/${this.table}/bulk`,
      data,
      params
    })).data
  }

  async delete(id) {
    return this.$axios({
      method: 'delete',
      url: `/nc/${this.$ctx.projectId}/api/v1/${this.table}/${encodeURIComponent(id)}`
    })
  }

  get $axios() {
    return this.$ctx.$axios
  }

  get apiUrl() {
    return `${process.env.NODE_ENV === 'production'
      ? `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`
      : 'http://localhost:8080'}/nc/${this.$ctx.projectId}/api/v1/${this.table}`
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
