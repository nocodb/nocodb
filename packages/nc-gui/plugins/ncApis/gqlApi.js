export default class GqlApi {
  constructor(table, $ctx) {
    this.$ctx = $ctx
    this.table = $ctx.$store.state.meta.metas[table]._tn
  }

  get meta() {
    return this.$ctx.$store.state.meta.metas[this.$ctx.table] || {}
  }

  get columns() {
    return this.meta.columns || []
  }

  // todo:  - get version letter and use table alias
  async list(params) {
    const data = await this.post(`/nc/${this.$ctx.projectId}/v1/graphql`, {
      query: await this.gqlQuery(params),
      variables: null
    })
    return data.data.data[this.gqlQueryListName]
  }

  async count(params) {
    const data = await this.post(`/nc/${this.$ctx.projectId}/v1/graphql`, {
      query: this.gqlCountQuery(params),
      variables: null
    })
    return data.data.data[this.gqlQueryCountName]
  }

  post(url, params) {
    return this.$axios({
      url: `${url}`,
      method: 'post',
      data: params
    })
  }

  generateQueryParams(params) {
    if (!params) {
      return '(where:"")'
    }
    const res = []
    if ('limit' in params) {
      res.push(`limit: ${params.limit}`)
    }
    if ('offset' in params) {
      res.push(`offset: ${params.offset}`)
    }
    if ('where' in params) {
      res.push(`where: ${JSON.stringify(params.where)}`)
    }
    if ('sort' in params) {
      res.push(`sort: ${JSON.stringify(params.sort)}`)
    }
    if (params.condition) {
      res.push(`condition: ${JSON.stringify(params.condition)}`)
    }
    if (params.conditionGraph) {
      res.push(`conditionGraph: ${JSON.stringify(JSON.stringify(params.conditionGraph))}`)
    }
    return `(${res.join(',')})`
  }

  async gqlQuery(params) {
    return `{${this.gqlQueryListName}${this.generateQueryParams(params)}{${this.gqlReqBody}${await this.gqlRelationReqBody(params)}}}`
  }

  async gqlReadQuery(id, params = {}) {
    return `{${this.gqlQueryReadName}(id:"${id}"){${this.gqlReqBody}${await this.gqlRelationReqBody(params)}}}`
  }

  gqlCountQuery(params) {
    return `{${this.gqlQueryCountName}${this.generateQueryParams(params)}}`
  }

  get gqlQueryListName() {
    return `${this.meta._tn}List`
  }

  get gqlQueryReadName() {
    return `${this.meta._tn}Read`
  }

  get tableCamelized() {
    return `${this.meta._tn}`
  }

  get gqlReqBody() {
    return `\n${this.columns.map(c => c._cn).join('\n')}\n`
  }

  // todo: query only visible columns
  async gqlRelationReqBody(params = {}) {
    let str = ''
    if (params.hm) {
      for (const child of params.hm.split(',')) {
        await this.$ctx.$store.dispatch('meta/ActLoadMeta', {
          dbAlias: this.$ctx.dbAlias,
          env: this.$ctx.env,
          tn: child
        })
        const meta = this.$ctx.$store.state.meta.metas[child]
        if (meta) {
          str += `\n${meta._tn}List{\n${meta.columns.map(c => c._cn).join('\n')}\n}`
        }
      }
    }
    if (params.bt) {
      for (const parent of params.bt.split(',')) {
        await this.$ctx.$store.dispatch('meta/ActLoadMeta', {
          dbAlias: this.$ctx.dbAlias,
          env: this.$ctx.env,
          tn: parent
        })
        const meta = this.$ctx.$store.state.meta.metas[parent]
        if (meta) {
          str += `\n${meta._tn}Read{\n${meta.columns.map(c => c._cn).join('\n')}\n}`
        }
      }
    }
    if (params.mm) {
      for (const mm of params.mm.split(',')) {
        await this.$ctx.$store.dispatch('meta/ActLoadMeta', {
          dbAlias: this.$ctx.dbAlias,
          env: this.$ctx.env,
          tn: mm
        })
        const meta = this.$ctx.$store.state.meta.metas[mm]
        if (meta) {
          str += `\n${meta._tn}MMList{\n${meta.columns.map(c => c._cn).join('\n')}\n}`
        }
      }
    }
    // add formula columns to query
    str += this.meta.v.reduce((arr, v) => {
      if (v.formula || v.rollup) {
        arr.push(v._cn)
      }
      return arr
    }, []).join('\n')

    return str
  }

  get gqlQueryCountName() {
    return `${this.tableCamelized}Count`
  }

  get gqlMutationCreateName() {
    return `${this.tableCamelized}Create`
  }

  get gqlMutationUpdateName() {
    return `${this.tableCamelized}Update`
  }

  get gqlMutationDeleteName() {
    return `${this.tableCamelized}Delete`
  }

  async paginatedList(params) {
    // const list = await this.list(params);
    // const count = (await this.count({where: params.where || ''}));
    const [list, count] = await Promise.all([
      this.list(params), this.count({
        where: params.where || '',
        conditionGraph: params.conditionGraph,
        condition: params.condition
      })
    ])
    return { list, count }
  }

  async update(id, data, oldData, params = {}) {
    const data1 = await this.post(`/nc/${this.$ctx.projectId}/v1/graphql`, {
      query: `mutation update($id:String!, $data:${this.tableCamelized}Input){
         ${this.gqlMutationUpdateName}(id: $id, data: $data){${this.gqlReqBody}${await this.gqlRelationReqBody(params)}}
      }`,
      variables: {
        id, data
      }
    })

    const colName = Object.keys(data)[0]
    this.$ctx.$store.dispatch('sqlMgr/ActSqlOp', [{ dbAlias: this.$ctx.dbAlias }, 'xcAuditCreate', {
      tn: this.table,
      cn: colName,
      pk: id,
      value: data[colName],
      prevValue: oldData[colName]
    }])

    return data1.data.data[this.gqlMutationUpdateName]
  }

  async insert(data, params = {}) {
    const data1 = await this.post(`/nc/${this.$ctx.projectId}/v1/graphql`, {
      query: `mutation create($data:${this.tableCamelized}Input){
         ${this.gqlMutationCreateName}(data: $data){${this.gqlReqBody}${await this.gqlRelationReqBody(params)}}
      }`,
      variables: {
        data
      }
    })
    return data1.data.data[this.gqlMutationCreateName]
  }

  async delete(id) {
    const data1 = await this.post(`/nc/${this.$ctx.projectId}/v1/graphql`, {
      query: `mutation delete($id:String!){
         ${this.gqlMutationDeleteName}(id: $id)
      }`,
      variables: { id }
    })

    return data1.data.data[this.gqlMutationDeleteName]
  }

  async read(id, params = {}) {
    const data = await this.post(`/nc/${this.$ctx.projectId}/v1/graphql`, {
      query: await this.gqlReadQuery(id, params),
      variables: null
    })
    return data.data.data[this.gqlQueryReadName]
  }

  get $axios() {
    return this.$ctx.$axios
  }

  async paginatedM2mNotChildrenList(params, assoc, pid) {
    const list = await this.post(`/nc/${this.$ctx.projectId}/v1/graphql`, {
      query: `query m2mNotChildren($pid: String!,$assoc:String!,$parent:String!, $limit:Int, $offset:Int){
           m2mNotChildren(pid: $pid,assoc:$assoc,parent:$parent,limit:$limit, offset:$offset)
      }`,
      variables: {
        parent: this.meta.tn, assoc, pid: pid + '', ...params
      }
    })
    const count = await this.post(`/nc/${this.$ctx.projectId}/v1/graphql`, {
      query: `query m2mNotChildrenCount($pid: String!,$assoc:String!,$parent:String!){
           m2mNotChildrenCount(pid: $pid,assoc:$assoc,parent:$parent)
      }`,
      variables: {
        parent: this.meta.tn, assoc, pid: pid + ''
      }
    })
    return { list: list.data.data.m2mNotChildren, count: count.data.data.m2mNotChildrenCount.count }
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
