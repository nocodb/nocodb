import { Injectable } from '@nestjs/common';
import { ClientType, PlanFeatureTypes } from 'nocodb-sdk';
import { SourcesService as SourcesServiceCE } from 'src/services/sources.service';
import type { BaseReqType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MetaService } from '~/meta/meta.service';
import { checkForFeature } from '~/helpers/paymentHelpers';

@Injectable()
export class SourcesService extends SourcesServiceCE {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected metaService: MetaService,
  ) {
    super(appHooksService);
  }

  async baseCreate(
    context: NcContext,
    param: {
      baseId: string;
      source: BaseReqType;
      logger?: (message: string) => void;
      req: any;
    },
  ) {
    if ((param.source?.config as any)?.client === ClientType.MSSQL) {
      await checkForFeature(context, PlanFeatureTypes.FEATURE_MSSQL);
    }

    return super.baseCreate(context, param);
  }
}
