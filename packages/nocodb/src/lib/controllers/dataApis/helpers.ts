import Project from '../../models/Project';
import Model from '../../models/Model';
import View from '../../models/View';
import { NcError } from '../../meta/helpers/catchError';
import { Request } from 'express';
import Base from '../../models/Base';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import { isSystemColumn, UITypes } from 'nocodb-sdk';

import { nocoExecute } from 'nc-help';
import * as XLSX from 'xlsx';
import Column from '../../models/Column';
import LookupColumn from '../../models/LookupColumn';
import LinkToAnotherRecordColumn from '../../models/LinkToAnotherRecordColumn';

import papaparse from 'papaparse';
import getAst from '../../db/sql-data-mapper/lib/sql/helpers/getAst';
export async function getViewAndModelFromRequestByAliasOrId(
  req:
    | Request<{ projectName: string; tableName: string; viewName?: string }>
    | Request
) {
  const project = await Project.getWithInfoByTitleOrId(req.params.projectName);

  const model = await Model.getByAliasOrId({
    project_id: project.id,
    aliasOrId: req.params.tableName,
  });
  const view =
    req.params.viewName &&
    (await View.getByTitleOrId({
      titleOrId: req.params.viewName,
      fk_model_id: model.id,
    }));
  if (!model) NcError.notFound('Table not found');
  return { model, view };
}

export async function extractXlsxData(view: View, req: Request) {
  const base = await Base.get(view.base_id);

  await view.getModelWithInfo();
  await view.getColumns();

  view.model.columns = view.columns
    .filter((c) => c.show)
    .map(
      (c) =>
        new Column({ ...c, ...view.model.columnsById[c.fk_column_id] } as any)
    )
    .filter((column) => !isSystemColumn(column) || view.show_system_fields);

  const baseModel = await Model.getBaseModelSQL({
    id: view.model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const { offset, dbRows, elapsed } = await getDbRows(baseModel, view, req);

  const fields = req.query.fields as string[];

  const data = XLSX.utils.json_to_sheet(dbRows, { header: fields });

  return { offset, dbRows, elapsed, data };
}

export async function extractCsvData(view: View, req: Request) {
  const base = await Base.get(view.base_id);
  const fields = req.query.fields;

  await view.getModelWithInfo();
  await view.getColumns();

  view.model.columns = view.columns
    .filter((c) => c.show)
    .map(
      (c) =>
        new Column({ ...c, ...view.model.columnsById[c.fk_column_id] } as any)
    )
    .filter((column) => !isSystemColumn(column) || view.show_system_fields);

  const baseModel = await Model.getBaseModelSQL({
    id: view.model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const { offset, dbRows, elapsed } = await getDbRows(baseModel, view, req);

  const data = papaparse.unparse(
    {
      fields: view.model.columns
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

  return { offset, dbRows, elapsed, data };
}

async function getDbRows(baseModel, view: View, req: Request) {
  let offset = +req.query.offset || 0;
  const limit = 100;
  // const size = +process.env.NC_EXPORT_MAX_SIZE || 1024;
  const timeout = +process.env.NC_EXPORT_MAX_TIMEOUT || 5000;
  const dbRows = [];
  const startTime = process.hrtime();
  let elapsed, temp;

  const listArgs: any = { ...req.query };
  try {
    listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
  } catch (e) {}
  try {
    listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
  } catch (e) {}

  for (
    elapsed = 0;
    elapsed < timeout;
    offset += limit,
      temp = process.hrtime(startTime),
      elapsed = temp[0] * 1000 + temp[1] / 1000000
  ) {
    const rows = await nocoExecute(
      await getAst({
        query: req.query,
        includePkByDefault: false,
        model: view.model,
        view,
      }),
      await baseModel.list({ ...listArgs, offset, limit }),
      {},
      req.query
    );

    if (!rows?.length) {
      offset = -1;
      break;
    }

    for (const row of rows) {
      const dbRow = { ...row };

      for (const column of view.model.columns) {
        if (isSystemColumn(column) && !view.show_system_fields) continue;
        dbRow[column.title] = await serializeCellValue({
          value: row[column.title],
          column,
          siteUrl: req['ncSiteUrl'],
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
  siteUrl,
}: {
  column?: Column;
  value: any;
  siteUrl: string;
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
          `${encodeURI(attachment.title)}(${encodeURI(
            attachment.path ? `${siteUrl}/${attachment.path}` : attachment.url
          )})`
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
                siteUrl,
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

export async function getColumnByIdOrName(
  columnNameOrId: string,
  model: Model
) {
  const column = (await model.getColumns()).find(
    (c) =>
      c.title === columnNameOrId ||
      c.id === columnNameOrId ||
      c.column_name === columnNameOrId
  );

  if (!column)
    NcError.notFound(`Column with id/name '${columnNameOrId}' is not found`);

  return column;
}
