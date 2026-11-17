import { precisionFormats, SqlUiFactory, UITypes } from 'nocodb-sdk';
import type Source from '~/models/Source';
import type Column from '~/models/Column';
import type { ColumnType } from 'nocodb-sdk';

export default function getColumnUiType(
  source: Source,
  column: Column | ColumnType,
) {
  const sqlUi = SqlUiFactory.create({ client: source.type });
  return sqlUi.getMetaUIDataType(column as ColumnType);
}

/**
 * Meta for an introspected column. A Decimal column gets `precision` from its
 * DB scale (`dtxs`), otherwise the UI falls back to 1 decimal place.
 */
export function getIntrospectedColumnMeta(
  uidt: UITypes | string,
  column: { dtxs?: string | number | null; meta?: any },
) {
  if (
    uidt !== UITypes.Decimal ||
    column.meta?.precision !== undefined ||
    column.dtxs === null ||
    column.dtxs === undefined ||
    column.dtxs === ''
  ) {
    return column.meta;
  }

  const scale = Number(column.dtxs);
  if (!Number.isInteger(scale) || scale < 0) return column.meta;

  return {
    ...(column.meta || {}),
    precision: Math.min(scale, precisionFormats[precisionFormats.length - 1]),
  };
}
