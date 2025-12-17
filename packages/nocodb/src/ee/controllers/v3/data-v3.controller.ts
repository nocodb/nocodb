import { Datav3Controller as Datav3ControllerCE } from 'src/controllers/v3/data-v3.controller';
import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { DataRecord } from '~/services/v3/data-v3.types';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { DataTableService } from '~/services/data-table.service';
import { DataAttachmentV3Service } from '~/services/v3/data-attachment-v3.service';
import { PREFIX_APIV3_DATA } from '~/constants/controllers';
import { AiDataService } from '~/integrations/ai/module/services/ai-data.service';
import { Model } from '~/models';
import { QUERY_STRING_FIELD_ID_ON_RESULT } from '~/constants';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class Datav3Controller extends Datav3ControllerCE {
  constructor(
    protected readonly dataV3Service: DataV3Service,
    protected readonly dataTableService: DataTableService,
    protected readonly dataAttachmentV3Service: DataAttachmentV3Service,
    protected readonly aiDataService: AiDataService,
  ) {
    super(dataV3Service, dataTableService, dataAttachmentV3Service);
  }

  @Post(`${PREFIX_APIV3_DATA}/:modelId/actions/:columnId`)
  @HttpCode(200)
  @Acl('aiData', {
    scope: 'base',
  })
  async triggerAction(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('modelId') modelId: string,
    @Param('columnId') columnId: string,
    @Body()
    body: {
      rowIds: string[];
    },
  ): Promise<DataRecord[]> {
    const result = await this.aiDataService.generateRows(context, {
      modelId,
      columnId,
      rowIds: body.rowIds,
      preview: false,
      req,
    });

    if (!result || !Array.isArray(result)) {
      return [];
    }

    const model = await Model.get(context, modelId);
    const columns = await model.getColumns(context);

    return await this.dataV3Service.transformRecordsToV3Format({
      context,
      records: result,
      primaryKey: model.primaryKey,
      primaryKeys: model.primaryKeys,
      columns,
      requestedFields: undefined,
      nestedLimit: undefined,
      skipSubstitutingColumnIds:
        req.query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
      reuse: {}, // Create reuse cache for this data insert operation
      depth: 0, // Start at depth 0 for main records
    });
  }
}
