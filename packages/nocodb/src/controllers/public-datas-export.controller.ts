import {
  Controller,
  Get,
  Param,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import { ErrorMessages, isSystemColumn, ViewTypes } from 'nocodb-sdk';
import * as XLSX from 'xlsx';
import { nocoExecute } from 'nc-help';
import papaparse from 'papaparse';
import { NcError } from '~/helpers/catchError';
import getAst from '~/helpers/getAst';
import { serializeCellValue } from '~/modules/datas/helpers';
import { PublicDatasExportService } from '~/services/public-datas-export.service';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Column, Model, Source, View } from '~/models';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';

@UseGuards(PublicApiLimiterGuard)
@Controller()
export class PublicDatasExportController {
  constructor(
    private readonly publicDatasExportService: PublicDatasExportService,
  ) {}

  @Get([
    '/api/v1/db/public/shared-view/:publicDataUuid/rows/export/excel',
    '/api/v2/public/shared-view/:publicDataUuid/rows/export/excel',
  ])
  async exportExcel(
    @Request() req,
    @Response() res,
    @Param('publicDataUuid') publicDataUuid: string,
  ) {
    const view = await View.getByUUID(publicDataUuid);
    if (!view) NcError.notFound('Not found');
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.MAP
    )
      NcError.notFound('Not found');

    if (view.password && view.password !== req.headers?.['xc-password']) {
      NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
    }

    const model = await view.getModelWithInfo();

    await view.getColumns();

    const { offset, dbRows, elapsed } = await this.getDbRows(model, view, req);

    const fields = req.query.fields as string[];

    const data = XLSX.utils.json_to_sheet(
      dbRows.map((o: Record<string, any>) =>
        Object.fromEntries(fields.map((f) => [f, o[f]])),
      ),
      { header: fields },
    );

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, data, view.title);

    const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    res.set({
      'Access-Control-Expose-Headers': 'nc-export-offset',
      'nc-export-offset': offset,
      'nc-export-elapsed-time': elapsed,
      'Content-Disposition': `attachment; filename="${encodeURI(
        view.title,
      )}-export.xlsx"`,
    });
    res.end(buf);
  }

  @Get([
    '/api/v1/db/public/shared-view/:publicDataUuid/rows/export/csv',
    '/api/v2/public/shared-view/:publicDataUuid/rows/export/csv',
  ])
  async exportCsv(@Request() req, @Response() res) {
    const view = await View.getByUUID(req.params.publicDataUuid);
    const fields = req.query.fields;

    if (!view) NcError.notFound('Not found');
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.MAP
    )
      NcError.notFound('Not found');

    if (view.password && view.password !== req.headers?.['xc-password']) {
      NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
    }

    const model = await view.getModelWithInfo();
    await view.getColumns();

    const { offset, dbRows, elapsed } = await this.getDbRows(model, view, req);

    const data = papaparse.unparse(
      {
        fields: model.columns
          .sort((c1, c2) =>
            Array.isArray(fields)
              ? fields.indexOf(c1.title as any) -
                fields.indexOf(c2.title as any)
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

    res.set({
      'Access-Control-Expose-Headers': 'nc-export-offset',
      'nc-export-offset': offset,
      'nc-export-elapsed-time': elapsed,
      'Content-Disposition': `attachment; filename="${encodeURI(
        view.title,
      )}-export.csv"`,
    });
    res.send(data);
  }

  async getDbRows(model, view: View, req) {
    view.model.columns = view.columns
      .filter((c) => c.show)
      .map(
        (c) =>
          new Column({
            ...c,
            ...view.model.columnsById[c.fk_column_id],
          } as any),
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

    const source = await Source.get(model.source_id);
    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const { ast } = await getAst({
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
        ast,
        await baseModel.list({ ...listArgs, offset, limit }),
        {},
        listArgs,
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
            siteUrl: req.ncSiteUrl,
          });
        }
        dbRows.push(dbRow);
      }
    }
    return { offset, dbRows, elapsed };
  }
}
