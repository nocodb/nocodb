import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { NcContext } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { License } from '~/ee/decorators/license.decorator';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { AttachmentsService } from '~/services/attachments.service';
import { FileReference } from '~/models';
import { serveStoredAttachment } from '~/helpers/attachmentHelpers';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AttachmentProxyController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get('/api/v2/data/bases/:baseId/docs/:docId/attachment/:fileId')
  @Acl('documentGet')
  async serveDocAttachment(
    @TenantContext() context: NcContext,
    @Param('docId') docId: string,
    @Param('fileId') fileRefId: string,
    @Res() res: Response,
  ) {
    const fileRef = await FileReference.get(context, fileRefId);

    if (!fileRef || fileRef.fk_doc_id !== docId) {
      return res.status(404).send('Attachment not found');
    }

    if (!fileRef.deleted) {
      return this.serveAttachment(fileRef.file_url, res);
    }

    // Soft-deleted — keep serving if a revision snapshot still references it.
    const stillReferenced = await FileReference.existsActiveByFileUrlInDoc(
      context,
      docId,
      fileRef.file_url,
    );
    if (!stillReferenced) {
      return res.status(404).send('Attachment not found');
    }

    return this.serveAttachment(fileRef.file_url, res);
  }

  /**
   * Serve a SmartText cell attachment. The (tableId, columnId, rowId) triple
   * scopes the lookup to one cell — the FileReference must match all three.
   */
  @Get(
    '/api/v2/data/bases/:baseId/tables/:tableId/columns/:columnId/rows/:rowId/attachment/:fileId',
  )
  @License(PlanFeatureTypes.FEATURE_EE_CORE)
  @Acl('smartTextGetAttachment')
  async serveSmartTextAttachment(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
    @Param('fileId') fileRefId: string,
    @Res() res: Response,
  ) {
    const fileRef = await FileReference.get(context, fileRefId);

    if (
      !fileRef ||
      fileRef.deleted ||
      fileRef.fk_model_id !== tableId ||
      fileRef.fk_column_id !== columnId ||
      fileRef.fk_row_id !== rowId
    ) {
      return res.status(404).send('Attachment not found');
    }

    return this.serveAttachment(fileRef.file_url, res);
  }

  private serveAttachment(fileUrl: string, res: Response) {
    return serveStoredAttachment(res, fileUrl, {
      attachmentsService: this.attachmentsService,
      // Authed proxy uses the default presigned TTL; access is already
      // gated by the global guard so a longer URL window is acceptable.
      cacheControl: 'private, max-age=300',
    });
  }
}
