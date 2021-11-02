import {
  MssqlUi,
  MysqlUi,
  OracleUi,
  PgUi,
  SqliteUi,
  SqlUiFactory
} from '../sqlUi';
import UITypes from '../sqlUi/UITypes';

export default class NcTemplateParser {
  sqlUi:
    | typeof MysqlUi
    | typeof MssqlUi
    | typeof PgUi
    | typeof OracleUi
    | typeof SqliteUi;

  private _tables: any[];
  private client: string;
  private _relations: any[];
  private _m2mRelations: any[];
  private _virtualColumns: { [tn: string]: any[] };
  private prefix: string;
  private template: any;

  constructor({client, template, prefix = ''}) {
    this.client = client;
    this.sqlUi = SqlUiFactory.create({client});
    this.template = template;
    this.prefix = prefix
  }

  public parse(template?: any): any {
    const tables = [];
    this.template = template || this.template;
    const tableTemplates = this.template.tables.map(tableTemplate => {
      const t = {
        ...tableTemplate,
        tn: this.getTable(tableTemplate.tn),
        _tn: tableTemplate._tn || tableTemplate.tn
      }
      const table = this.extractTable(t);
      tables.push(table);
      return t
    })

    this._tables = tables;

    for (const tableTemplate of tableTemplates) {
      this.extractRelations(tableTemplate);
      this.extractVirtualColumns(tableTemplate);
    }
  }

  private extractTable(tableTemplate) {
    if (!tableTemplate?.tn) {
      throw Error('Missing table name in template');
    }

    const defaultColumns = this.sqlUi
      .getNewTableColumns()
      .filter(
        column =>
          column.cn !== 'title' &&
          (column.uidt !== 'ID' ||
            tableTemplate.columns.every(c => c.uidt !== 'ID'))
      );

    return {
      tn: tableTemplate.tn,
      _tn: tableTemplate._tn,
      columns: [
        defaultColumns[0],
        ...this.extractTableColumns(tableTemplate.columns),
        ...defaultColumns.slice(1),
      ]
    };
  }

  private extractTableColumns(tableColumns: any[]) {
    const columns = [];
    for (const tableColumn of tableColumns) {
      if (!tableColumn?.cn) {
        throw Error('Missing column name in template');
      }
      switch (tableColumn.uidt) {
        // case UITypes.ForeignKey:
        //   // todo :
        //   this.extractRelations(tableColumn, 'bt');
        //   break;
        // case UITypes.LinkToAnotherRecord:
        //   // todo :
        //   this.extractRelations(tableColumn, 'hm');
        //   // this.extractRelations(tableColumn, 'mm');
        //   break;
        default:
          const colProp = this.sqlUi.getDataTypeForUiType(tableColumn);
          columns.push({
            ...this.sqlUi.getNewColumn(''),
            rqd: false,
            pk: false,
            ai: false,
            cdf: null,
            un: false,
            dtx: 'specificType',
            dtxp: this.sqlUi.getDefaultLengthForDatatype(colProp.dt),
            dtxs: this.sqlUi.getDefaultScaleForDatatype(colProp.dt),
            cn: tableColumn.cn,
            _cn: tableColumn.cn,
            uidt: tableColumn.uidt,
            ...colProp
          });
          break;
      }
    }
    return columns;
  }

  protected extractRelations(tableTemplate) {
    if (!this._relations) this._relations = [];
    if (!this._m2mRelations) this._m2mRelations = [];
    for (const hasMany of tableTemplate.hasMany || []) {
      const childTable = this.tables.find(table => table.tn === this.getTable(hasMany.tn));
      const parentTable = this.tables.find(
        table => table.tn === tableTemplate.tn
      );
      const parentPrimaryColumn = parentTable.columns.find(
        column => column.uidt === UITypes.ID
      );

      // add a column in child table
      const childColumnName = `${tableTemplate.tn}_id`;

      childTable.columns.push({
        cn: childColumnName,
        _cn: childColumnName,
        rqd: false,
        pk: false,
        ai: false,
        cdf: null,
        dt: parentPrimaryColumn.dt,
        dtxp: parentPrimaryColumn.dtxp,
        dtxs: parentPrimaryColumn.dtxs,
        un: parentPrimaryColumn.un,
        altered: 1
      });

      // add relation create entry
      this._relations.push({
        childColumn: childColumnName,
        childTable: childTable.tn,
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
        parentColumn: parentPrimaryColumn.cn,
        parentTable: tableTemplate.tn,
        type: this.client === 'sqlite3' ? 'virtual' : 'real',
        updateRelation: false
      });
    }
    for (const manyToMany of tableTemplate.manyToMany || []) {
      // @ts-ignore
      const childTable = this.tables.find(table => table.tn === this.getTable(manyToMany.rtn));
      const parentTable = this.tables.find(
        table => table.tn === tableTemplate.tn
      );
      const parentPrimaryColumn = parentTable.columns.find(
        column => column.uidt === UITypes.ID
      );
      const childPrimaryColumn = childTable.columns.find(
        column => column.uidt === UITypes.ID
      );

      // add many to many relation create entry
      this._m2mRelations.push({
        alias: 'title8',
        childColumn: childPrimaryColumn.cn,
        childTable: childTable.tn,
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
        parentColumn: parentPrimaryColumn.cn,
        parentTable: parentTable.tn,
        type: this.client === 'sqlite3' ? 'virtual' : 'real',
        updateRelation: false
      });
    }
  }

  private extractVirtualColumns(tableMeta) {
    if (!this._virtualColumns) this._virtualColumns = {};
    const virtualColumns = [];
    for (const v of (tableMeta.v || [])) {
      const v1 = {...v}
      let type, prop;

      switch (v.uidt) {
        case UITypes.Rollup:
          type = v.rl.type
          prop = 'rl'
          break;
        case UITypes.Lookup:
          type = v.lk.type
          prop = 'lk'
          break;
      }

      if (type && prop) {
        // todo: extract relation data
      } else {
        virtualColumns.push(v1)
      }

    }
    this.virtualColumns[tableMeta.tn] = virtualColumns;
  }

  get tables(): any[] {
    return this._tables;
  }

  get relations(): any[] {
    return this._relations;
  }

  get m2mRelations(): any[] {
    return this._m2mRelations;
  }

  get virtualColumns(): { [tn: string]: any[] } {
    return this._virtualColumns;
  }

  private getTable(tn) {
    return `${this.prefix}${tn}`
  }
}
