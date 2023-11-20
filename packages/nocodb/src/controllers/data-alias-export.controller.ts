import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { GlobalGuard } from '~/guards/global/global.guard';
import { DatasService } from '~/services/datas.service';
import { extractCsvData, extractXlsxData } from '~/modules/datas/helpers';
import { View } from '~/models';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class DataAliasExportController {
  constructor(private datasService: DatasService) {}

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/export/excel',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/export/excel',
  ])
  @Acl('exportExcel')
  async excelDataExport(@Req() req: Request, @Res() res: Response) {
    const { model, view } =
      await this.datasService.getViewAndModelFromRequestByAliasOrId(req);
    let targetView = view;
    if (!targetView) {
      targetView = await View.getDefaultView(model.id);
    }
    const { offset, elapsed, data } = await extractXlsxData(targetView, req);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, data, targetView.title);
    const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    res.set({
      'Access-Control-Expose-Headers': 'nc-export-offset',
      'nc-export-offset': offset,
      'nc-export-elapsed-time': elapsed,
      'Content-Disposition': `attachment; filename="${encodeURI(
        targetView.title,
      )}-export.xlsx"`,
    });
    res.end(buf);
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/export/csv',
    '/api/v1/db/data/:orgs/:baseName/:tableName/export/csv',
  ])
  @Acl('exportCsv')
  async csvDataExport(@Req() req: Request, @Res() res: Response) {
    const { model, view } =
      await this.datasService.getViewAndModelFromRequestByAliasOrId(req);
    let targetView = view;
    if (!targetView) {
      targetView = await View.getDefaultView(model.id);
    }
    const { offset, elapsed, data } = await extractCsvData(targetView, req);

    res.set({
      'Access-Control-Expose-Headers': 'nc-export-offset',
      'nc-export-offset': offset,
      'nc-export-elapsed-time': elapsed,
      'Content-Disposition': `attachment; filename="${encodeURI(
        targetView.title,
      )}-export.csv"`,
    });
    res.send(data);
  }
}
