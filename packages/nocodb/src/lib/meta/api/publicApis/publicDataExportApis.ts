import { Request, Response, Router } from 'express';
import * as XLSX from 'xlsx';
import View from '../../../models/View';
import Model from '../../../models/Model';
import Base from '../../../models/Base';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import { nocoExecute } from 'nc-help';
import papaparse from 'papaparse';
import { ErrorMessages, isSystemColumn, UITypes, ViewTypes } from 'nocodb-sdk';
import Column from '../../../models/Column';
import LinkToAnotherRecordColumn from '../../../models/LinkToAnotherRecordColumn';
import LookupColumn from '../../../models/LookupColumn';
import catchError, { NcError } from '../../helpers/catchError';
import getAst from '../../../db/sql-data-mapper/lib/sql/helpers/getAst';

async function exportExcel(req: Request, res: Response) {
  const view = await View.getByUUID(req.params.publicDataUuid);
  if (!view) NcError.notFound('Not found');
  if (
    view.type !== ViewTypes.GRID &&
    view.type !== ViewTypes.KANBAN &&
    view.type !== ViewTypes.GALLERY
  )
    NcError.notFound('Not found');

  if (view.password && view.password !== req.headers?.['xc-password']) {
    NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
  }

  const model = await view.getModelWithInfo();
  await view.getColumns();

  const { offset, dbRows, elapsed } = await getDbRows(model, view, req);

  const fields = req.query.fields as string[];

  const data = XLSX.utils.json_to_sheet(dbRows, { header: fields });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, data, view.title);
  const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  res.set({
    'Access-Control-Expose-Headers': 'nc-export-offset',
    'nc-export-offset': offset,
    'nc-export-elapsed-time': elapsed,
    'Content-Disposition': `attachment; filename="${encodeURI(
      view.title
    )}-export.xlsx"`,
  });
  res.end(buf);
}

async function exportCsv(req: Request, res: Response) {
  const view = await View.getByUUID(req.params.publicDataUuid);
  const fields = req.query.fields;

  if (!view) NcError.notFound('Not found');
  if (
    view.type !== ViewTypes.GRID &&
    view.type !== ViewTypes.KANBAN &&
    view.type !== ViewTypes.GALLERY
  )
    NcError.notFound('Not found');

  if (view.password && view.password !== req.headers?.['xc-password']) {
    NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
  }

  const model = await view.getModelWithInfo();
  await view.getColumns();

  const { offset, dbRows, elapsed } = await getDbRows(model, view, req);

  const data = papaparse.unparse(
    {
      fields: model.columns
        .sort((c1, c2) =>
          Array.isArray(fields)
            ? fields.indexOf(c1.title as any) - fields.indexOf(c2.title as any)
            : 0
        )
        .filter(
          (c) =>
            !fields || !Array.isArray(fields) || fields.includes(c.title as any)
        )
        .map((c) => c.title),
      data: dbRows,
    },
    {
      escapeFormulae: true,
    }
  );

  res.set({
    'Access-Control-Expose-Headers': 'nc-export-offset',
    'nc-export-offset': offset,
    'nc-export-elapsed-time': elapsed,
    'Content-Disposition': `attachment; filename="${encodeURI(
      view.title
    )}-export.csv"`,
  });
  res.send(data);
}

async function getDbRows(model, view: View, req: Request) {
  view.model.columns = view.columns
    .filter((c) => c.show)
    .map(
      (c) =>
        new Column({ ...c, ...view.model.columnsById[c.fk_column_id] } as any)
    )
    .filter((column) => !isSystemColumn(column) || view.show_system_fields);

  if (!model) NcError.notFound('Table not found');

  const listArgs: any = { ...req.query };
  try {
    listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
  } catch (e) {}
  try {
    listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
  } catch (e) {}

  const base = await Base.get(model.base_id);
  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const requestObj = await getAst({
    query: req.query,
    model,
    view,
    includePkByDefault: false,
  });

  let offset = +req.query.offset || 0;
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

      for (const column of view.model.columns) {
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

async function serializeCellValue({
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
            return v[relatedModel.primaryValue?.title];
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

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/public/shared-view/:publicDataUuid/rows/export/csv',
  catchError(exportCsv)
);
router.get(
  '/api/v1/db/public/shared-view/:publicDataUuid/rows/export/excel',
  catchError(exportExcel)
);
export default router;
