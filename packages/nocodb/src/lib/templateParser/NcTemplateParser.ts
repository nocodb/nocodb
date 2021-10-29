import {
  MssqlUi,
  MysqlUi,
  OracleUi,
  PgUi,
  SqliteUi,
  SqlUiFactory
} from '../sqlUi';

export default class NcTemplateParser {
  sqlUi:
    | typeof MysqlUi
    | typeof MssqlUi
    | typeof PgUi
    | typeof OracleUi
    | typeof SqliteUi;

  constructor(client) {
    this.sqlUi = SqlUiFactory.create({ client });
  }

  public parse(template: any): any {
    const tables = [];
    for (const tableTemplate of template.tables) {
      const table = this.extractTable(tableTemplate);
      tables.push(table);
    }

    return { tables };
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
      const column = {
        ...this.sqlUi.getNewColumn(''),
        cn: tableColumn.cn,
        _cn: tableColumn.cn,
        uidt: tableColumn.uidt,
        ...this.sqlUi.getDataTypeForUiType(tableColumn)
      };
      columns.push(column);
    }
    return columns;
  }

  private ex;
}
