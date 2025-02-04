import { convertMS2Duration, isSystemColumn, UITypes } from 'nocodb-sdk';
import * as XLSX from 'xlsx';
import papaparse from 'papaparse';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import type LookupColumn from '~/models/LookupColumn';
import type { NcContext } from '~/interface/config';
import { nocoExecute } from '~/utils';
import { NcError } from '~/helpers/catchError';
import getAst from '~/helpers/getAst';
import { Model, View } from '~/models';
import Source from '~/models/Source';
import Column from '~/models/Column';
import Base from '~/models/Base';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

export interface PathParams {
  baseName: string;
  tableName: string;
  viewName?: string;
}

export interface OldPathParams {
  baseId: string;
  tableName: string;
  viewName?: string;
}

export async function getViewAndModelByAliasOrId(
  context: NcContext,
  param: {
    baseName: string;
    tableName: string;
    viewName?: string;
  },
) {
  const base = await Base.getWithInfoByTitleOrId(context, param.baseName);

  const model = await Model.getByAliasOrId(context, {
    base_id: base.id,
    aliasOrId: param.tableName,
  });

  if (!model) NcError.tableNotFound(param.tableName);

  const view =
    param.viewName &&
    (await View.getByTitleOrId(context, {
      titleOrId: param.viewName,
      fk_model_id: model.id,
    }));
  if (param.viewName && !view) NcError.viewNotFound(param.viewName);

  return { model, view };
}

export async function extractXlsxData(context: NcContext, view: View, req) {
  const source = await Source.get(context, view.source_id);

  await view.getModelWithInfo(context);
  await view.getColumns(context);

  view.model.columns = view.columns
    .filter((c) => c.show)
    .map(
      (c) =>
        new Column({ ...c, ...view.model.columnsById[c.fk_column_id] } as any),
    )
    .filter((column) => !isSystemColumn(column) || view.show_system_fields);

  const baseModel = await Model.getBaseModelSQL(context, {
    id: view.model.id,
    viewId: view?.id,
    dbDriver: await NcConnectionMgrv2.get(source),
  });

  const { offset, dbRows, elapsed } = await getDbRows(context, {
    baseModel,
    view,
    siteUrl: (req as any).ncSiteUrl,
    query: req.query,
  });

  const fields = req.query.fields as string[];

  const data = XLSX.utils.json_to_sheet(dbRows, { header: fields });

  return { offset, dbRows, elapsed, data };
}

export async function extractCsvData(context: NcContext, view: View, req) {
  const source = await Source.get(context, view.source_id);
  const fields = req.query.fields;

  await view.getModelWithInfo(context);
  await view.getColumns(context);

  view.model.columns = view.columns
    .filter((c) => c.show)
    .map(
      (c) =>
        new Column({ ...c, ...view.model.columnsById[c.fk_column_id] } as any),
    )
    .filter((column) => !isSystemColumn(column) || view.show_system_fields);

  const baseModel = await Model.getBaseModelSQL(context, {
    id: view.model.id,
    viewId: view?.id,
    dbDriver: await NcConnectionMgrv2.get(source),
  });

  const { offset, dbRows, elapsed } = await getDbRows(context, {
    baseModel,
    view,
    query: req.query,
    siteUrl: (req as any).ncSiteUrl,
  });

  const data = papaparse.unparse(
    {
      fields: view.model.columns
        .sort((c1, c2) =>
          Array.isArray(fields)
            ? fields.indexOf(c1.title as any) - fields.indexOf(c2.title as any)
            : 0,
        )
        .filter(
          (c) =>
            !fields ||
            !Array.isArray(fields) ||
            fields.includes(c.title as any),
        )
        .map((c) => c.title),
      data: dbRows,
    },
    {
      escapeFormulae: true,
    },
  );

  return { offset, dbRows, elapsed, data };
}

export async function serializeCellValue(
  context: NcContext,
  {
    value,
    column,
    siteUrl,
  }: {
    column?: Column;
    value: any;
    siteUrl: string;
  },
) {
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

        if (!Array.isArray(data)) {
          data = [data];
        }
      } catch {
        data = undefined;
      }

      return (data || [])
        .filter((attachment) => attachment)
        .map(
          (attachment) =>
            `${attachment.title || 'Attachment'}(${encodeURI(
              attachment.signedPath
                ? `${siteUrl}/${attachment.signedPath}`
                : attachment.signedUrl,
            )})`,
        )
        .join(', ');
    }
    case UITypes.User:
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy: {
      let data = value;
      try {
        if (typeof value === 'string') {
          data = JSON.parse(value);
        }
      } catch {}

      return (data ? (Array.isArray(data) ? data : [data]) : [])
        .map((user) => `${user.email}`)
        .join(', ');
    }
    case UITypes.Lookup:
      {
        const colOptions = await column.getColOptions<LookupColumn>(context);
        const lookupColumn = await colOptions.getLookupColumn(context);
        return (
          await Promise.all(
            [...(Array.isArray(value) ? value : [value])].map(async (v) =>
              serializeCellValue(context, {
                value: v,
                column: lookupColumn,
                siteUrl,
              }),
            ),
          )
        ).join(', ');
      }
      break;
    case UITypes.LinkToAnotherRecord:
      {
        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>(context);
        const relatedModel = await colOptions.getRelatedTable(context);
        await relatedModel.getColumns(context);
        return [...(Array.isArray(value) ? value : [value])]
          .map((v) => {
            return v[relatedModel.displayValue?.title];
          })
          .join(', ');
      }
      break;
    case UITypes.Decimal:
      {
        if (isNaN(Number(value))) return null;

        return Number(value).toFixed(column.meta?.precision ?? 1);
      }
      break;
    case UITypes.Duration: {
      if (column.meta?.duration === undefined) {
        return value;
      }
      return convertMS2Duration(value, column.meta.duration);
    }
    default:
      if (value && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
  }
}

export async function getColumnByIdOrName(
  context: NcContext,
  columnNameOrId: string,
  model: Model,
) {
  const column = (await model.getColumns(context)).find(
    (c) =>
      c.title === columnNameOrId ||
      c.id === columnNameOrId ||
      c.column_name === columnNameOrId,
  );

  if (!column) NcError.fieldNotFound(columnNameOrId);

  return column;
}

export async function getDbRows(
  context: NcContext,
  param: {
    baseModel: BaseModelSqlv2;
    view: View;
    query: any;
    siteUrl: string;
  },
) {
  const { baseModel, view, query = {}, siteUrl } = param;
  let offset = +query.offset || 0;
  const limit = 100;
  // const size = +process.env.NC_EXPORT_MAX_SIZE || 1024;
  const timeout = +process.env.NC_EXPORT_MAX_TIMEOUT || 5000;
  const dbRows = [];
  const startTime = process.hrtime();
  let elapsed, temp;

  const listArgs: any = { ...query };
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
    const { ast, dependencyFields } = await getAst(context, {
      query: query,
      includePkByDefault: false,
      model: view.model,
      view,
    });
    const rows = await nocoExecute(
      ast,
      await baseModel.list({ ...listArgs, ...dependencyFields, offset, limit }),
      {},
      dependencyFields,
    );

    if (!rows?.length) {
      offset = -1;
      break;
    }

    for (const row of rows) {
      const dbRow = { ...row };

      for (const column of view.model.columns) {
        if (isSystemColumn(column) && !view.show_system_fields) continue;
        dbRow[column.title] = await serializeCellValue(context, {
          value: row[column.title],
          column,
          siteUrl,
        });
      }
      dbRows.push(dbRow);
    }
  }
  return { offset, dbRows, elapsed };
}
