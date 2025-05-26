import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuditV1OperationTypes } from 'nocodb-sdk';
import { BulkDataAliasController as BulkDataAliasControllerCE } from 'src/controllers/bulk-data-alias.controller';
import type { DataImportPayload } from 'nocodb-sdk';
import { generateAuditV1Payload } from '~/utils';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { Audit, Model } from '~/models';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
@Controller()
export class BulkDataAliasController extends BulkDataAliasControllerCE {
  constructor(protected bulkDataAliasService: BulkDataAliasService) {
    super(bulkDataAliasService);
  }

  @Post(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName'])
  @HttpCode(200)
  @Acl('bulkDataInsert')
  async bulkDataInsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    let parentAuditId = req.headers['nc-operation-id'] as string;

    if (!parentAuditId) {
      const model = await Model.get(context, tableName);

      parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

      await Audit.insert(
        await generateAuditV1Payload<DataImportPayload>(
          AuditV1OperationTypes.DATA_IMPORT,
          {
            details: {
              import_type: req.headers['nc-import-type'] as 'csv' | 'excel',
              table_id: model?.id ?? tableName,
              table_title: model?.title ?? tableName,
              view_id: null,
              view_title: null,
            },
            context,
            fk_model_id: model?.id ?? tableName,
            req,
            id: parentAuditId,
          },
        ),
      );
    }

    req.ncParentAuditId = parentAuditId;

    const exists = await this.bulkDataAliasService.bulkDataInsert(context, {
      body: body,
      cookie: req,
      baseName: baseName,
      tableName: tableName,
    });

    res.header('nc-operation-id', req.ncParentAuditId).json(exists);
  }
}
