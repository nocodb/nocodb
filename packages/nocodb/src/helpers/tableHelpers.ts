import { TableSystemColumns } from './columnHelpers';
import { NcError } from './ncError';
import type { ColumnType, NcContext, UITypes } from 'nocodb-sdk';

export const verifyCreateTableSystemColumns = (
  context: NcContext,
  { columns }: { columns: ColumnType[] },
) => {
  const columnNameMap = new Map<string, ColumnType>();
  const titleMap = new Map<string, ColumnType>();
  const addingColumn = [];

  const addSystemColumn = (col) => {
    const [allowNonSystem, ...colToAdd] = col;
    addingColumn.push(colToAdd);
  };

  for (const systemColumn of TableSystemColumns()) {
    const existingColumns = columns.filter(
      (col) =>
        col.title === systemColumn.title ||
        col.column_name === systemColumn.column_name ||
        col.uidt === systemColumn.column_name,
    );
    if (existingColumns.length > 1 && !systemColumn.allowNonSystem) {
      NcError.get(context).invalidRequestBody(
        `Column with type ` + systemColumn.uidt + ` is only 1 allowed`,
      );
    }
    if (existingColumns.length) {
      const existingColumn = existingColumns[0];
      const isMatch =
        existingColumn.title === systemColumn.title &&
        existingColumn.column_name === systemColumn.column_name &&
        existingColumn.uidt === systemColumn.column_name;

      if (!isMatch && !systemColumn.allowNonSystem) {
        const identifier = systemColumn.title
          ? `title '` + systemColumn.title + `'`
          : systemColumn.column_name
          ? `column_name '` + systemColumn.column_name + `'`
          : `type '` + systemColumn.uidt + `'`;
        NcError.get(context).invalidRequestBody(
          `Column with ${identifier} does not meet specification`,
        );
      } else if (!isMatch && systemColumn.allowNonSystem) {
        addSystemColumn(systemColumn);
      } else {
      }
    } else {
      addSystemColumn(systemColumn);
    }
  }
};
