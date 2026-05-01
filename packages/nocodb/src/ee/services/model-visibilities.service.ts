import { Injectable } from '@nestjs/common';
import { ModelVisibilitiesService as ModelVisibilitiesServiceCE } from 'src/services/model-visibilities.service';
import type { VisibilityRuleReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { NcContext } from '~/interface/config';
import { assertNotSandbox } from '~/helpers/sandboxGuards';

@Injectable()
export class ModelVisibilitiesService extends ModelVisibilitiesServiceCE {
  async xcVisibilityMetaSetAll(
    context: NcContext,
    param: {
      visibilityRule: VisibilityRuleReqType;
      baseId: string;
      req: NcRequest;
    },
  ) {
    await assertNotSandbox(context);
    return super.xcVisibilityMetaSetAll(context, param);
  }
}
