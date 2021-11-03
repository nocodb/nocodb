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
  private _relations: any[];
  private _m2mRelations: any[];
  private template: any;

  constructor({ client, template }) {
    this.sqlUi = SqlUiFactory.create({ client });
    this.template = template;
  }

  public parse(template?: any): any {
    const tables = [];
    this.template = template || this.template;
    for (const tableTemplate of this.template.tables) {
      const table = this.extractTable(tableTemplate);
      tables.push(table);
    }

    this._tables = tables;

    for (const tableTemplate of this.template.tables) {
      this.extractRelations(tableTemplate);
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
      columns: [
        ...defaultColumns,
        ...this.extractTableColumns(tableTemplate.columns)
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
          columns.push({
            ...this.sqlUi.getNewColumn(''),
            cn: tableColumn.cn,
            _cn: tableColumn.cn,
            uidt: tableColumn.uidt,
            ...this.sqlUi.getDataTypeForUiType(tableColumn)
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
      const childTable = this.tables.find(table => table.tn === hasMany.tn);
      const partentTable = this.tables.find(
        table => table.tn === tableTemplate.tn
      );
      const parentPrimaryColumn = partentTable.columns.find(
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
        childTable: hasMany.tn,
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
        parentColumn: parentPrimaryColumn.cn,
        parentTable: tableTemplate.tn,
        type: 'real',
        updateRelation: false
      });
    }
    for (const manyToMany of tableTemplate.manyToMany || []) {
      // @ts-ignore
      const childTable = this.tables.find(table => table.tn === manyToMany.rtn);
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
        type: 'real',
        updateRelation: false
      });
    }
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
}
