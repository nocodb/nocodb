import { Injectable } from '@nestjs/common';
import { ColumnsV3Service as ColumnsV3ServiceCE } from 'src/services/v3/columns-v3.service';
import type { UserType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { ReusableParams } from '~/services/columns.service';
import type { ColumnWebhookManager } from '~/utils/column-webhook-manager';
import type { MetaService } from '~/meta/meta.service';
import { ColumnsService } from '~/services/columns.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';

@Injectable()
export class ColumnsV3Service extends ColumnsV3ServiceCE {
  constructor(
    protected readonly columnsService: ColumnsService,
    protected readonly baseTrashService: BaseTrashService,
  ) {
    super(columnsService);
  }

  async columnDelete(
    context: NcContext,
    param: {
      req?: any;
      columnId: string;
      user: UserType;
      forceDeleteSystem?: boolean;
      reuse?: ReusableParams;
      columnWebhookManager?: ColumnWebhookManager;
    },
    _ncMeta?: MetaService,
  ) {
    await this.baseTrashService.trashResource(context, {
      resourceId: param.columnId,
      resourceType: 'field',
      user: param.user,
      req: param.req,
    });
    return {};
  }
}
