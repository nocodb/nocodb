import { Body, Controller, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { CsvImportJobData, JobTypes } from '~/interface/Jobs';
import { JobsService } from '~/modules/jobs/jobs.service';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { NcRequest } from '~/interface/config';

@Controller()
export class CsvImportController {
  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  @Post(['/api/v2/tables/:tableId/csv-import'])
  @UseGuards(GlobalGuard)
  @Acl('csvImport')
  async csvImportToExistingTable(
    @Req() req: NcRequest,
    @Body() body: any,
  ) {
    const { baseId, sourceId, modelId } = req.params;

    const job = await this.jobsService.add(
      JobTypes.CsvImport,
      {
        baseId,
        sourceId,
        modelId,
        csvData: body.csvData,
        columnMapping: body.columnMapping,
        options: {
          firstRowAsHeaders: body.options?.firstRowAsHeaders ?? true,
          delimiter: body.options?.delimiter,
          encoding: body.options?.encoding || 'utf-8',
          createNewTable: false,
        },
        user: req.user,
        jobName: 'CSV Import',
        context: {
          base_id: baseId,
          source_id: sourceId,
        },
      } as CsvImportJobData,
      req,
    );

    return job;
  }

  @Post(['/api/v2/bases/:baseId/sources/:sourceId/csv-import'])
  @UseGuards(GlobalGuard)
  @Acl('csvImport')
  async csvImportNewTable(
    @Req() req: NcRequest,
    @Body() body: any,
  ) {
    const { baseId, sourceId } = req.params;

    const job = await this.jobsService.add(
      JobTypes.CsvImport,
      {
        baseId,
        sourceId,
        csvData: body.csvData,
        columnMapping: body.columnMapping,
        options: {
          firstRowAsHeaders: body.options?.firstRowAsHeaders ?? true,
          delimiter: body.options?.delimiter,
          encoding: body.options?.encoding || 'utf-8',
          createNewTable: true,
          tableName: body.options?.tableName,
        },
        user: req.user,
        jobName: 'CSV Import',
        context: {
          base_id: baseId,
          source_id: sourceId,
        },
      } as CsvImportJobData,
      req,
    );

    return job;
  }
}
