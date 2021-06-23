import inflection from 'inflection';


export default class GqlApi {

  constructor(table, columns, $ctx) {
    // this.table = table;
    this.columns = columns;
    this.$ctx = $ctx;
  }

  // todo:  - get version letter and use table alias
  async list(params) {
    const data = await this.post(`/nc/${this.$ctx.$route.params.project_id}/v1/graphql`, {
      query: this.gqlQuery(params),
      variables: null
    });
    return data.data.data[this.gqlQueryListName];
  }

  async count(params) {
    const data = await this.post(`/nc/${this.$ctx.$route.params.project_id}/v1/graphql`, {
      query: this.gqlCountQuery(params),
      variables: null
    });
    return data.data.data[this.gqlQueryCountName];
  }


  post(url, params) {
    return this.$axios({
      url: `${this.$axios.defaults.baseURL}/${url}`,
      method: 'post',
      data: params,
    })
  }


  generateQueryParams(params) {
    if (!params) return '(where:"")';
    const res = [];
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
    return `(${res.join(',')})`;
  }

  gqlQuery(params) {
    return `{${this.gqlQueryListName}${this.generateQueryParams(params)}${this.gqlReqBody}}`
  }

  gqlReadQuery(id) {
    return `{${this.gqlQueryReadName}(id:"${id}")${this.gqlReqBody}}`
  }

  gqlCountQuery(params) {
    return `{${this.gqlQueryCountName}${this.generateQueryParams(params)}}`
  }

  get gqlQueryListName() {
    return `${this.table.replace(/(?:^|_)(.)/g, (_, m) => m.toUpperCase())}List`;
  }

  get gqlQueryReadName() {
    return `${this.table.replace(/(?:^|_)(.)/g, (_, m) => m.toUpperCase())}Read`;
  }

  get tableCamelized() {
    return `${this.table.replace(/(?:^|_)(.)/g, (_, m) => m.toUpperCase())}`;
  }

  get gqlReqBody() {
    return `{\n${this.columns.map(c => c._cn).join('\n')}\n}`
  }

  get gqlQueryCountName() {
    return `${this.tableCamelized}Count`;
  }

  get gqlMutationCreateName() {
    return `${this.tableCamelized}Create`;
  }

  get gqlMutationUpdateName() {
    return `${this.tableCamelized}Update`;
  }

  get gqlMutationDeleteName() {
    return `${this.tableCamelized}Delete`;
  }


  async paginatedList(params) {
    // const list = await this.list(params);
    // const count = (await this.count({where: params.where || ''}));
    const [list, count] = await Promise.all([this.list(params), this.count({where: params.where || ''})]);
    return {list, count};
  }


  async update(id, data,oldData) {
    const data1 = await this.post(`/nc/${this.$ctx.$route.params.project_id}/v1/graphql`, {
      query: `mutation update($id:String!, $data:${this.tableCamelized}Input){
         ${this.gqlMutationUpdateName}(id: $id, data: $data)
      }`,
      variables: {
        id, data
      }
    });

    const colName = Object.keys(data)[0];
    this.$ctx.$store.dispatch('sqlMgr/ActSqlOp', [{dbAlias: this.$ctx.nodes.dbAlias}, 'xcAuditCreate', {
      tn: this.table,
      cn: colName,
      pk: id,
      value: data[colName],
      prevValue: oldData[colName]
    }])

    return data1.data.data[this.gqlMutationUpdateName];
  }

  async insert(data) {

    const data1 = await this.post(`/nc/${this.$ctx.$route.params.project_id}/v1/graphql`, {
      query: `mutation create($data:${this.tableCamelized}Input){
         ${this.gqlMutationCreateName}(data: $data)${this.gqlReqBody}
      }`,
      variables: {
        data
      }
    });
    return data1.data.data[this.gqlMutationCreateName];
  }

  async delete(id) {
    const data1 = await this.post(`/nc/${this.$ctx.$route.params.project_id}/v1/graphql`, {
      query: `mutation delete($id:String!){
         ${this.gqlMutationDeleteName}(id: $id)
      }`,
      variables: {id}
    });

    return data1.data.data[this.gqlMutationDeleteName];
  }


  async read(id) {

    const data = await this.post(`/nc/${this.$ctx.$route.params.project_id}/v1/graphql`, {
      query: this.gqlReadQuery(id),
      variables: null
    });
    return data.data.data[this.gqlQueryReadName];

  }


  get $axios() {
    return this.$ctx.$axios;
  }

  get table() {
    return this.$ctx && this.$ctx.meta && this.$ctx.meta._tn && inflection.camelize(this.$ctx.meta._tn);
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
