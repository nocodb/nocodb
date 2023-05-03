import BaseGqlXcTsSchema from './BaseGqlXcTsSchema';

class GqlXcSchemaPg extends BaseGqlXcTsSchema {
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

  /*  /!**
   *
   * @param args
   * @param args.columns
   * @param args.relations
   * @returns {string}
   * @private
   *!/
  _renderColumns(args) {

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

  /*  _getInputType(args) {
    let str = `input ${args.tn_camelize}Input { \r\n`
    for (let i = 0; i < args.columns.length; ++i) {
      if (args.columns[i]._cn.split(' ').length > 1) {
        console.log(`Skipping ${args.tn}.${args.columns[i]._cn}`);
      } else {
        str += `\t\t${args.columns[i]._cn.replace(/ /g, '_')}: ${this._getGraphqlType(args.columns[i])},\r\n`;
      }

    }
    str += `\t}`;
    return str;
  }*/

  /*  _getQuery(args) {
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
  }*/

  /*  _getMutation(args) {
    let str = `type Mutation { \r\n`
    str += `\t\t${args.tn_camelize}Create(data:${args.tn_camelize}Input): ${args.tn_camelize}\r\n`
 str += `\t\t${args.tn_camelize}Update(id:String,data:${args.tn_camelize}Input):  Int\r\n` //${args.tn_camelize}\r\n`
    str += `\t\t${args.tn_camelize}Delete(id:String): Int\r\n`//${args.tn_camelize}\r\n`
    str += `\t\t${args.tn_camelize}CreateBulk(data: [${args.tn_camelize}Input]): [Int]\r\n`
    str += `\t\t${args.tn_camelize}UpdateBulk(data: [${args.tn_camelize}Input]): [Int]\r\n`
    str += `\t\t${args.tn_camelize}DeleteBulk(data: [${args.tn_camelize}Input]): [Int]\r\n`
    str += `\t},\r\n`
    return str;
  }*/

  /*  _getType(args) {

    let str = `type ${args.tn_camelize} { \r\n`
    let strWhere = `input Condition${args.tn_camelize} { \r\n`

    for (let i = 0; i < args.columns.length; ++i) {
      if (args.columns[i]._cn.split(' ').length > 1) {
        console.log(`Skipping ${args.tn}.${args.columns[i]._cn}`);
      } else {
        str += `\t\t${args.columns[i]._cn.replace(/ /g, '_')}: ${this._getGraphqlType(args.columns[i])},\r\n`;
        strWhere += `\t\t${args.columns[i]._cn.replace(/ /g, '_')}: ${this._getGraphqlConditionType(args.columns[i])},\r\n`;
      }

    }

    let hasManyRelations = args.relations.filter(r => r.rtn === args.tn);
    if (hasManyRelations.length > 1)
      hasManyRelations = lodash.uniqBy(hasManyRelations, function (e) {
        return [e.tn, e.rtn].join();
      });

    str += hasManyRelations.length ? `\r\n` : ``;
    // cityList in Country
    for (let i = 0; i < hasManyRelations.length; ++i) {
      let childTable = inflection.camelize(hasManyRelations[i]._tn)
      str += `\t\t${childTable}List: [${childTable}]\r\n`;
      strWhere += `\t\t${childTable}List: Condition${childTable}\r\n`;
      str += `\t\t${childTable}Count: Int\r\n`;
    }


    str+= this.generateManyToManyTypeProps(args);

    let belongsToRelations = args.relations.filter(r => r.tn === args.tn);
    if (belongsToRelations.length > 1)
      belongsToRelations = lodash.uniqBy(belongsToRelations, function (e) {
        return [e.tn, e.rtn].join();
      });

    str += belongsToRelations.length ? `\r\n` : ``;
    // Country withi city - this is reverse
    for (let i = 0; i < belongsToRelations.length; ++i) {
      let parentTable = inflection.camelize(belongsToRelations[i]._rtn)
      str += `\t\t${parentTable}Read(id:String): ${parentTable}\r\n`;
      strWhere += `\t\t${parentTable}Read: Condition${parentTable}\r\n`;
    }

    str += `\t}\r\n`

    const grpFields = Object.assign({}, GROUPBY_DEFAULT_COLS);

    str += `type ${args.tn_camelize}GroupBy { \r\n`
    for (let i = 0; i < args.columns.length; ++i) {
      if (args.columns[i]._cn in grpFields) {
        grpFields[args.columns[i]._cn] = `\t\t# ${args.columns[i]._cn} - clashes with column in table\r\n`;
      } else {
        str += `\t\t${args.columns[i]._cn.replace(/ /g, '_')}: ${this._getGraphqlType(args.columns[i])},\r\n`;
      }
    }
    str += Object.values(grpFields).join('');
    str += `\t}\r\n`

    const aggFields = Object.assign({}, AGG_DEFAULT_COLS);

    str += `type ${args.tn_camelize}Aggregate { \r\n`
    for (let i = 0; i < args.columns.length; ++i) {
      if (args.columns[i]._cn in aggFields) {
        aggFields[args.columns[i]._cn] = `\t\t# ${args.columns[i]._cn} - clashes with column in table\r\n`;
      } else {
        str += `\t\t${args.columns[i]._cn.replace(/ /g, '_')}: ${this._getGraphqlType(args.columns[i])},\r\n`;
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

  _getGraphqlType(columnObj) {
    switch (columnObj.dt) {
      case 'int':
      case 'integer':
      case 'bigint':
      case 'bigserial':
      case 'char':
      case 'int2':
      case 'int4':
      case 'int8':
      case 'int4range':
      case 'int8range':
      case 'serial':
      case 'serial2':
      case 'smallint':
      case 'smallserial':
      case 'serial8':
        if (columnObj.dtx === 'ARRAY') {
          return '[Int]';
        }
        return 'Int';
        break;

      case 'bit':
      case 'bool':
      case 'boolean':
        if (columnObj.dtx === 'ARRAY') {
          return '[Boolean]';
        }
        return 'Boolean';
        break;

      case 'money':
      case 'real':
      case 'float4':
      case 'float8':
        if (columnObj.dtx === 'ARRAY') {
          return '[Float]';
        }
        return 'Float';
        break;

      case 'json':
      case 'jsonb':
      case 'anyenum':
      case 'anynonarray':
      case 'path':
      case 'point':
      case 'polygon':
        if (columnObj.dtx === 'ARRAY') {
          return '[JSON]';
        }
        return 'JSON';

      case 'character':
      case 'uuid':
      case 'date':
      case 'double precision':
      case 'event_trigger':
      case 'fdw_handler':
      case 'character varying':
      case 'text':
      case 'time':
      case 'time without time zone':
      case 'timestamp':
      case 'timestamp without time zone':
      case 'timestamptz':
      case 'timestamp with time zone':
      case 'timetz':
      case 'time with time zone':
      case 'daterange':
      case 'gtsvector':
      case 'index_am_handler':
      case 'anyrange':
      case 'box':
      case 'bpchar':
      case 'bytea':
      case 'cid':
      case 'cidr':
      case 'circle':
      case 'cstring':
      case 'inet':
      case 'internal':
      case 'interval':
      case 'language_handler':
      case 'line':
      case 'lsec':
      case 'macaddr':
      case 'name':
      case 'numeric':
      case 'numrange':
      case 'oid':
      case 'opaque':
      case 'pg_ddl_command':
      case 'pg_lsn':
      case 'pg_node_tree':
      case 'record':
      case 'refcursor':
      case 'regclass':
      case 'regconfig':
      case 'regdictionary':
      case 'regnamespace':
      case 'regoper':
      case 'regoperator':
      case 'regproc':
      case 'regpreocedure':
      case 'regrole':
      case 'regtype':
      case 'reltime':
      case 'smgr':
      case 'tid':
      case 'tinterval':
      case 'trigger':
      case 'tsm_handler':
      case 'tsquery':
      case 'tsrange':
      case 'tstzrange':
      case 'tsvector':
      case 'txid_snapshot':
      case 'unknown':
      case 'void':
      case 'xid':
      case 'xml':
      default:
        if (columnObj.dtx === 'ARRAY') {
          return '[String]';
        }
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
      case '[JSON]':
        return 'ConditionString';
      case 'JSON':
        return 'ConditionString';
    }
  }

  /* getString(){
    return this._renderColumns(this.ctx);
  }*/
}

export default GqlXcSchemaPg;
