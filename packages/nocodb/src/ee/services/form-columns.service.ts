import { Injectable } from '@nestjs/common';
import { FormColumnsService as FormColumnsServiceCE } from 'src/services/form-columns.service';
import { PlanFeatureTypes } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { EEOnly } from '~/decorators/ee-only.decorator';
import { checkForFeature } from '~/helpers/paymentHelpers';

@Injectable()
export class FormColumnsService extends FormColumnsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @EEOnly()
  async columnBulkUpdate(
    context: NcContext,
    param: {
      formViewId: string;
      updates: Array<{ id: string; row_id?: string | null; order?: number }>;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_FORM_GRID_LAYOUT);
    return super.columnBulkUpdate(context, param, ncMeta);
  }
}
