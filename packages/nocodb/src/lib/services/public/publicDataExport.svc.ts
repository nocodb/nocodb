import { nocoExecute } from 'nc-help';
import { isSystemColumn, UITypes } from 'nocodb-sdk';
import getAst from '../../db/sql-data-mapper/lib/sql/helpers/getAst';
import { NcError } from '../../meta/helpers/catchError';
import {
  Base,
  Column,
  LinkToAnotherRecordColumn,
  LookupColumn,
  Model,
  View,
} from '../../models';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';

export async function getDbRows(param: {
  model;
  view: View;
  query: any;
  offset?: number;
}) {
  param.view.model.columns = param.view.columns
    .filter((c) => c.show)
    .map(
      (c) =>
        new Column({
          ...c,
          ...param.view.model.columnsById[c.fk_column_id],
        } as any)
    )
    .filter(
      (column) => !isSystemColumn(column) || param.view.show_system_fields
    );

  if (!param.model) NcError.notFound('Table not found');

  const listArgs: any = { ...param.query };
  try {
    listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
  } catch (e) {}
  try {
    listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
  } catch (e) {}

  const base = await Base.get(param.model.base_id);
  const baseModel = await Model.getBaseModelSQL({
    id: param.model.id,
    viewId: param.view?.id,
    dbDriver: await NcConnectionMgrv2.get(base),
  });

  const requestObj = await getAst({
    query: param.query,
    model: param.model,
    view: param.view,
    includePkByDefault: false,
  });

  let offset = +param.offset || 0;
  const limit = 100;
  // const size = +process.env.NC_EXPORT_MAX_SIZE || 1024;
  const timeout = +process.env.NC_EXPORT_MAX_TIMEOUT || 5000;
  const dbRows = [];
  const startTime = process.hrtime();
  let elapsed, temp;

  for (
    elapsed = 0;
    elapsed < timeout;
    offset += limit,
      temp = process.hrtime(startTime),
      elapsed = temp[0] * 1000 + temp[1] / 1000000
  ) {
    const rows = await nocoExecute(
      requestObj,
      await baseModel.list({ ...listArgs, offset, limit }),
      {},
      listArgs
    );

    if (!rows?.length) {
      offset = -1;
      break;
    }

    for (const row of rows) {
      const dbRow = { ...row };

      for (const column of param.view.model.columns) {
        dbRow[column.title] = await serializeCellValue({
          value: row[column.title],
          column,
        });
      }
      dbRows.push(dbRow);
    }
  }
  return { offset, dbRows, elapsed };
}

export async function serializeCellValue({
  value,
  column,
}: {
  column?: Column;
  value: any;
}) {
  if (!column) {
    return value;
  }

  if (!value) return value;

  switch (column?.uidt) {
    case UITypes.Attachment: {
      let data = value;
      try {
        if (typeof value === 'string') {
          data = JSON.parse(value);
        }
      } catch {}

      return (data || []).map(
        (attachment) =>
          `${encodeURI(attachment.title)}(${encodeURI(attachment.url)})`
      );
    }
    case UITypes.Lookup:
      {
        const colOptions = await column.getColOptions<LookupColumn>();
        const lookupColumn = await colOptions.getLookupColumn();
        return (
          await Promise.all(
            [...(Array.isArray(value) ? value : [value])].map(async (v) =>
              serializeCellValue({
                value: v,
                column: lookupColumn,
              })
            )
          )
        ).join(', ');
      }
      break;
    case UITypes.LinkToAnotherRecord:
      {
        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>();
        const relatedModel = await colOptions.getRelatedTable();
        await relatedModel.getColumns();
        return [...(Array.isArray(value) ? value : [value])]
          .map((v) => {
            return v[relatedModel.displayValue?.title];
          })
          .join(', ');
      }
      break;
    default:
      if (value && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
  }
}
