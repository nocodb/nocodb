import BaseGqlXcTsSchema from './BaseGqlXcTsSchema';

class GqlXcSchemaSqlite extends BaseGqlXcTsSchema {
  /**
   *
   * @param dir
   * @param filename
   * @param ct
   * @param ctx.tn
   * @param ctx.columns
   * @param ctx.relations
   */
  constructor({ dir, filename, ctx }) {
    super({ dir, filename, ctx });
  }

  /*/!**
   *
   * @param args
   * @param args.columns
   * @param args.relations
   * @returns {string}
   * @private
   *!/
  public _renderColumns(args): string {

    let str = '';

    str += `
    ${this._getInputType(args)}\r\n
    ${this._getQuery(args)},\r\n
    ${this._getMutation(args)}\r\n
    ${this._getType(args)}\r\n
    `

    str += '';

    return str;

  }*/

  protected _getGraphqlType(columnObj): any {
    switch (columnObj.dt) {
      case 'int':
      case 'integer':
      case 'tinyint':
      case 'smallint':
      case 'mediumint':
      case 'bigint':
      case 'int2':
      case 'int8':
        return 'Int';
        break;

      case 'character':
      case 'blob sub_type text':
      case 'blob':
        return 'String';
        break;

      case 'real':
      case 'double':
      case 'double precision':
      case 'float':
      case 'numeric':
        return 'Float';
        break;

      case 'boolean':
        return 'Boolean';
        break;

      case 'date':
      case 'datetime':
      case 'text':
      case 'varchar':
      case 'timestamp':
        return 'String';
        break;

      default:
        return 'String';
        break;
    }
  }

  protected _getGraphqlConditionType(columnObj): any {
    switch (this._getGraphqlType(columnObj.dt)) {
      case 'Int':
        return 'ConditionInt';
      case 'Float':
        return 'ConditionFloat';
      case 'Boolean':
        return 'ConditionBoolean';
      case 'String':
        return 'ConditionString';
      case '[String]':
        return 'ConditionString';
    }
  }

  /*
  public getString(): string {
    return this._renderColumns(this.ctx);
  }
*/
  /*
  protected _getInputType(args): string {
    let str = `input ${args.tn_camelize}Input { \r\n`
    for (const column of args.columns) {
      if (column._cn.split(' ').length > 1) {
        // str += `\t\t${column._cn}: ${this._getGraphqlType(column)},\r\n`;
      } else {
        str += `\t\t${column._cn}: ${this._getGraphqlType(column)},\r\n`;
      }
    }
    str += `\t}`;
    return str;
  }

  protected _getQuery(args): string {
    let str = `type Query { \r\n`
    str += `\t\t${args.tn_camelize}List(where: String,condition:Condition${args.tn_camelize}, limit: Int, offset: Int, sort: String): [${args.tn_camelize}]\r\n`
    str += `\t\t${args.tn_camelize}Read(id:String!): ${args.tn_camelize}\r\n`
    str += `\t\t${args.tn_camelize}Exists(id: String!): Boolean\r\n`
    str += `\t\t${args.tn_camelize}FindOne(where: String,condition:Condition${args.tn_camelize}): ${args.tn_camelize}\r\n`
    str += `\t\t${args.tn_camelize}Count(where: String,condition:Condition${args.tn_camelize}): Int\r\n`
    str += `\t\t${args.tn_camelize}Distinct(column_name: String, where: String,condition:Condition${args.tn_camelize}, limit: Int, offset: Int, sort: String): [${args.tn_camelize}]\r\n`
    str += `\t\t${args.tn_camelize}GroupBy(fields: String, having: String, limit: Int, offset: Int, sort: String): [${args.tn_camelize}GroupBy]\r\n`
    str += `\t\t${args.tn_camelize}Aggregate(column_name: String!, having: String, limit: Int, offset: Int, sort: String, func: String!): [${args.tn_camelize}Aggregate]\r\n`
    str += `\t\t${args.tn_camelize}Distribution(min: Int, max: Int, step: Int, steps: String, column_name: String!): [distribution]\r\n`
    str += `\t}\r\n`
    return str;
  }

  protected _getMutation(args): string {
    let str = `type Mutation { \r\n`
    str += `\t\t${args.tn_camelize}Create(data:${args.tn_camelize}Input): ${args.tn_camelize}\r\n`
    str += `\t\t${args.tn_camelize}Update(id:String,data:${args.tn_camelize}Input):  Int\r\n` // ${args.tn_camelize}\r\n`
    str += `\t\t${args.tn_camelize}Delete(id:String): Int\r\n`// ${args.tn_camelize}\r\n`
    str += `\t\t${args.tn_camelize}CreateBulk(data: [${args.tn_camelize}Input]): [Int]\r\n`
    str += `\t\t${args.tn_camelize}UpdateBulk(data: [${args.tn_camelize}Input]): [Int]\r\n`
    str += `\t\t${args.tn_camelize}DeleteBulk(data: [${args.tn_camelize}Input]): [Int]\r\n`
    str += `\t},\r\n`
    return str;
  }

  protected _getType(args): string {

    let str = `type ${args.tn_camelize} { \r\n`
    let strWhere = `input Condition${args.tn_camelize} { \r\n`

    for (const column of args.columns.length) {
      str += `\t\t${column._cn}: ${this._getGraphqlType(column)},\r\n`;
      strWhere += `\t\t${column._cn.replace(/ /g, '_')}: ${this._getGraphqlConditionType(column)},\r\n`;
    }

    let hasManyRelations = args.relations.filter(r => r.rtn === args.tn);
    if (hasManyRelations.length > 1) {
      hasManyRelations = lodash.uniqBy(hasManyRelations, (e) => {
        return [e.tn, e.rtn].join();
      });
    }
    str += hasManyRelations.length ? `\r\n` : ``;
    // cityList in Country
    for (const {_tn} of hasManyRelations.length) {
      const childTable = inflection.camelize(_tn)
      str += `\t\t${childTable}List: [${childTable}]\r\n`;
      strWhere += `\t\t${childTable}List: Condition${childTable}\r\n`;
      str += `\t\t${childTable}Count: Int\r\n`;
    }

    str += this.generateManyToManyTypeProps(args);

    let belongsToRelations = args.relations.filter(r => r.tn === args.tn);
    if (belongsToRelations.length > 1) {
      belongsToRelations = lodash.uniqBy(belongsToRelations, (e) => {
        return [e.tn, e.rtn].join();
      });
    }

    str += belongsToRelations.length ? `\r\n` : ``;
    // Country withi city - this is reverse
    for (const {_rtn} of belongsToRelations.length) {
      const parentTable = inflection.camelize(_rtn)
      str += `\t\t${parentTable}Read(id:String): ${parentTable}\r\n`;
      strWhere += `\t\t${parentTable}Read: Condition${parentTable}\r\n`;
    }

    str += `\t}\r\n`

    const grpFields = {...GROUPBY_DEFAULT_COLS};

    str += `type ${args.tn_camelize}GroupBy { \r\n`
    for (let i = 0; i < args.columns.length; ++i) {
      if (args.columns[i]._cn in grpFields) {
        grpFields[args.columns[i]._cn] = `\t\t# ${args.columns[i]._cn} - clashes with column in table\r\n`;
      } else {
        str += `\t\t${args.columns[i]._cn}: ${this._getGraphqlType(args.columns[i])},\r\n`;
      }
    }
    str += Object.values(grpFields).join('');
    str += `\t}\r\n`;

    const aggFields = {...AGG_DEFAULT_COLS};

    str += `type ${args.tn_camelize}Aggregate { \r\n`
    for (let i = 0; i < args.columns.length; ++i) {
      if (args.columns[i]._cn in aggFields) {
        aggFields[args.columns[i]._cn] = `\t\t# ${args.columns[i]._cn} - clashes with column in table\r\n`;
      } else {
        str += `\t\t${args.columns[i]._cn}: ${this._getGraphqlType(args.columns[i])},\r\n`;
      }
    }

    str += Object.values(aggFields).join('');

    str += `\t}\r\n`
    strWhere += `
    _or:[Condition${args.tn_camelize}]
    _not:Condition${args.tn_camelize}
    _and:[Condition${args.tn_camelize}]
    
    \t}\r\n`


    return `${str}\r\n\r\n${strWhere}`;
  }*/
}

export default GqlXcSchemaSqlite;
