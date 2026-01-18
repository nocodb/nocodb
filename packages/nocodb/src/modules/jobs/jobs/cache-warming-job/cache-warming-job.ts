import path from 'path';
import { Readable } from 'stream';
import slash from 'slash';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import type { Job } from 'bull';
import { UITypes, type AttachmentResType } from 'nocodb-sdk';
import type { CacheWarmingJobData } from '~/interface/Jobs';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';
import { Model, PresignedUrl, Source, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import { DatasService } from '~/services/datas.service';
import { Injectable, Logger } from '@nestjs/common';

import Noco from '~/Noco';
import NcConnectionMgrv2 from 'src/utils/common/NcConnectionMgrv2';
import { RootScopes } from 'src/utils/globals';
import { Base } from 'airtable';

@Injectable()
export class CacheWarmingJob {
  private logger = new Logger(CacheWarmingJob.name);

  constructor(private datasService: DatasService) {}

  async job(job: Job) {
    const context = {
      base_id: 'po8bajgqamssw6f',
      workspace_id: RootScopes.ROOT,
    };
    const baseId = 'po8bajgqamssw6f';
    const modelId = 'myr7f4mjpjvrcdm';

    const model = await Model.get(context, modelId);

    if (!model) NcError.tableNotFound(modelId);

    await model.getColumns(context);
    await model.getViews(context);

    var attachmentsColumns = [];
    for (const column of model.columns) {
      if (column.uidt == UITypes.Attachment) {
        attachmentsColumns.push(column);
      }
    }

    let fields = model.columns.map((c) => c.title).join(',');
    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });
    const cachePageSize = 100;
    var data = await this.datasService.getDataList(context, {
      model,
      query: { sort: '-CreatedAt', offset: 0, limit: cachePageSize, fields },
      baseModel,
      ignoreViewFilterAndSort: true,
      limitOverride: cachePageSize,
      ignoreCache: true,
    });

    while (true) {
      this.logger.log('Starting cache warming');
      var offset = 0;
      while (offset < 1000 && !data.pageInfo.isLastPage) {
        data = await this.datasService.getDataList(context, {
          model,
          query: {
            sort: '-CreatedAt',
            offset: offset,
            limit: cachePageSize,
            fields,
          },
          baseModel,
          ignoreViewFilterAndSort: true,
          limitOverride: cachePageSize,
          ignoreCache: true,
        });
        offset += data.pageInfo.pageSize;
        await new Promise((r) => setTimeout(r, 1000));
      }
      this.logger.log('End cache warming');
      await new Promise((r) => setTimeout(r, 1000 * 24 * 60 * 60));
    }
  }
}
