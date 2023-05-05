import uniqBy from 'lodash/uniqBy';
import BaseRender from '../../BaseRender';
import { AGG_DEFAULT_COLS, GROUPBY_DEFAULT_COLS } from './schemaHelp';

abstract class BaseGqlXcTsSchema extends BaseRender {
  /**
   *
   * @param dir
   * @param filename
   * @param ct
   * @param ctx.tn
   * @param ctx.columns
   * @param ctx.relations
   */
  protected constructor({ dir, filename, ctx }) {
    super({ dir, filename, ctx });
  }

  /**
   *  Prepare variables used in code template
   */
  public prepare(): any {
    const data: any = {};

    data.columns = {
      func: this._renderColumns.bind(this),
      args: this.ctx,
    };

    return data;
  }

  /**
   *
   * @param args
   * @param args.columns
   * @param args.relations
   * @returns {string}
   * @private
   */
  public _renderColumns(args): string {
    let str = '';

    str += `
    ${this._getInputType(args)}\r\n
    ${this._getQuery(args)},\r\n
    ${this._getMutation(args)}\r\n
    ${this._getType(args)}\r\n
    `;

    str += '';

    return str;
  }

  public getString(): string {
    return this._renderColumns(this.ctx);
  }

  protected generateManyToManyTypeProps(args: any): string {
    if (!args.manyToMany?.length) {
      return '';
    }
    let str = '\r\n';
    for (const mm of args.manyToMany) {
      str += `\t\t${mm._rtn}MMList(where: String,limit: Int, offset: Int, sort: String): [${mm._rtn}]\r\n`;
    }
    return str;
  }

  protected generateVirtualTypes(args: any): string {
    if (!args.v?.length) {
      return '';
    }
    const props = [];
    for (const v of args.v) {
      if (!v.formula && !v.rl) continue;
      props.push(`\t\t${v._cn}: JSON`);
    }
    return props.length ? `\r\n${props.join('\r\n')}\r\n` : '';
  }

  protected _getInputType(args): string {
    let str = `input ${args._tn}Input { \r\n`;
    for (const column of args.columns) {
      if (/\s/.test(column._cn)) {
        console.log(`Skipping ${args.tn}.${column._cn}`);
      } else {
        str += `\t\t${column._cn}: ${this._getGraphqlType(column)},\r\n`;
      }
    }
    str += `\t}`;
    return str;
  }

  protected _getQuery(args): string {
    let str = `type Query { \r\n`;
    str += `\t\t${args._tn}List(where: String,condition:Condition${args._tn}, limit: Int, offset: Int, sort: String,conditionGraph: String): [${args._tn}]\r\n`;
    str += `\t\t${args._tn}Read(id:String!): ${args._tn}\r\n`;
    str += `\t\t${args._tn}Exists(id: String!): Boolean\r\n`;
    str += `\t\t${args._tn}FindOne(where: String,condition:Condition${args._tn}): ${args._tn}\r\n`;
    str += `\t\t${args._tn}Count(where: String,condition:Condition${args._tn},conditionGraph: String): Int\r\n`;
    str += `\t\t${args._tn}Distinct(column_name: String, where: String,condition:Condition${args._tn}, limit: Int, offset: Int, sort: String): [${args._tn}]\r\n`;
    str += `\t\t${args._tn}GroupBy(fields: String, having: String, limit: Int, offset: Int, sort: String): [${args._tn}GroupBy]\r\n`;
    str += `\t\t${args._tn}Aggregate(column_name: String!, having: String, limit: Int, offset: Int, sort: String, func: String!): [${args._tn}Aggregate]\r\n`;
    str += `\t\t${args._tn}Distribution(min: Int, max: Int, step: Int, steps: String, column_name: String!): [distribution]\r\n`;
    str += `\t}\r\n`;
    return str;
  }

  protected _getMutation(args): string {
    let str = `type Mutation { \r\n`;
    str += `\t\t${args._tn}Create(data:${args._tn}Input): ${args._tn}\r\n`;
    str += `\t\t${args._tn}Update(id:String,data:${args._tn}Input):  ${args._tn}\r\n`; // ${args._tn}\r\n`
    str += `\t\t${args._tn}Delete(id:String): Int\r\n`; // ${args._tn}\r\n`
    str += `\t\t${args._tn}CreateBulk(data: [${args._tn}Input]): [Int]\r\n`;
    str += `\t\t${args._tn}UpdateBulk(data: [${args._tn}Input]): [Int]\r\n`;
    str += `\t\t${args._tn}DeleteBulk(data: [${args._tn}Input]): [Int]\r\n`;
    str += `\t},\r\n`;
    return str;
  }

  protected _getType(args): string {
    let str = `type ${args._tn} { \r\n`;
    let strWhere = `input Condition${args._tn} { \r\n`;

    for (const column of args.columns) {
      if (column._cn.split(' ').length > 1) {
        console.log(`Skipping ${args.tn}.${column._cn}`);
      } else {
        str += `\t\t${column._cn.replace(/ /g, '_')}: ${this._getGraphqlType(
          column,
        )},\r\n`;
        strWhere += `\t\t${column._cn.replace(
          / /g,
          '_',
        )}: ${this._getGraphqlConditionType(column)},\r\n`;
      }
    }

    let hasManyRelations = args.hasMany;
    if (hasManyRelations.length > 1) {
      hasManyRelations = uniqBy(hasManyRelations, (e) => {
        return [e.tn, e.rtn].join();
      });
    }

    str += hasManyRelations.length ? `\r\n` : ``;
    // cityList in Country
    for (const { _tn } of hasManyRelations) {
      const childTable = _tn;
      str += `\t\t${childTable}List(where: String,limit: Int, offset: Int, sort: String): [${childTable}]\r\n`;
      strWhere += `\t\t${childTable}List: Condition${childTable}\r\n`;
      str += `\t\t${childTable}Count: Int\r\n`;
    }

    str += this.generateManyToManyTypeProps(args);
    str += this.generateVirtualTypes(args);

    let belongsToRelations = args.belongsTo;
    if (belongsToRelations.length > 1) {
      belongsToRelations = uniqBy(belongsToRelations, (e) => {
        return [e.tn, e.rtn].join();
      });
    }

    str += belongsToRelations.length ? `\r\n` : ``;
    // Country withi city - this is reverse
    for (const { _rtn } of belongsToRelations) {
      const parentTable = _rtn;
      str += `\t\t${parentTable}Read(id:String): ${parentTable}\r\n`;
      strWhere += `\t\t${parentTable}Read: Condition${parentTable}\r\n`;
    }

    str += `\t}\r\n`;

    const grpFields = { ...GROUPBY_DEFAULT_COLS };

    str += `type ${args._tn}GroupBy { \r\n`;
    for (const { _cn, ...rest } of args.columns) {
      if (_cn in grpFields) {
        grpFields[_cn] = `\t\t# ${_cn} - clashes with column in table\r\n`;
      } else {
        str += `\t\t${_cn.replace(/ /g, '_')}: ${this._getGraphqlType(
          rest,
        )},\r\n`;
      }
    }
    str += Object.values(grpFields).join('');
    str += `\t}\r\n`;

    const aggFields = { ...AGG_DEFAULT_COLS };

    str += `type ${args._tn}Aggregate { \r\n`;
    for (const column of args.columns) {
      if (column._cn in aggFields) {
        aggFields[
          column._cn
        ] = `\t\t# ${column._cn} - clashes with column in table\r\n`;
      } else {
        str += `\t\t${column._cn.replace(/ /g, '_')}: ${this._getGraphqlType(
          column,
        )},\r\n`;
      }
    }
    str += Object.values(aggFields).join('');

    str += `\t}\r\n`;
    strWhere += `
    _or:[Condition${args._tn}]
    _not:Condition${args._tn}
    _and:[Condition${args._tn}]
    
    \t}\r\n`;

    return `${str}\r\n\r\n${strWhere}`;
  }

  protected abstract _getGraphqlType(column: any): string;

  protected abstract _getGraphqlConditionType(columnObj): string;
}

export default BaseGqlXcTsSchema;
