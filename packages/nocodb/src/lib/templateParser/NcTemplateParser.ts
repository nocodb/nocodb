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
  private template: any;

  constructor({ client, template }) {
    this.sqlUi = SqlUiFactory.create({ client });
    this.template = template;
  }

  public parse(template?: any): any {
    const tables = [];
    this.template = template || this.template;
    for (const tableTemplate of this.template._tables) {
      const table = this.extractTable(tableTemplate);
      tables.push(table);
    }

    this._tables = tables;
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

      if (
        tableColumn.uidt === UITypes.LinkToAnotherRecord ||
        tableColumn.uidt === UITypes.ForeignKey
      ) {
        // todo :
      } else {
        const column = {
          ...this.sqlUi.getNewColumn(''),
          cn: tableColumn.cn,
          _cn: tableColumn.cn,
          uidt: tableColumn.uidt,
          ...this.sqlUi.getDataTypeForUiType(tableColumn)
        };
        columns.push(column);
      }
    }
    return columns;
  }

  protected extractRelations(_columnTemplate) {
    if (!this._relations) this._relations = [];
  }

  get tables(): any[] {
    return this._tables;
  }

  get relations(): any[] {
    return this._relations;
  }
}
