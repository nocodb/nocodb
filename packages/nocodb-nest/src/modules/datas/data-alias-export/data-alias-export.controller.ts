import { Controller, Get, Request, Response, UseGuards } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { AuthGuard } from '@nestjs/passport';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../../middlewares/extract-project-id/extract-project-id.middleware';
import { View } from '../../../models';
import { DatasService } from '../datas.service';
import { extractCsvData, extractXlsxData } from '../helpers';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
export class DataAliasExportController {
  constructor(private datasService: DatasService) {}

  @Get([
    '/api/v1/db/data/:orgs/:projectName/:tableName/export/excel',
    '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/export/excel',
  ])
  @Acl('exportExcel')
  async excelDataExport(@Request() req, @Response() res) {
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
    '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/export/csv',
    '/api/v1/db/data/:orgs/:projectName/:tableName/export/csv',
  ])
  @Acl('exportCsv')
  async csvDataExport(@Request() req, @Response() res) {
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
