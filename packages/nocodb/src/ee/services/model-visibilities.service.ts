import { Injectable } from '@nestjs/common';
import { ModelVisibilitiesService as ModelVisibilitiesServiceCE } from 'src/services/model-visibilities.service';
import type { VisibilityRuleReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { visibilityActions } from '~/decorators/trace-command-descriptions';
import { MetaTable } from '~/utils/globals';
import { assertNotSandbox } from '~/helpers/sandboxGuards';

@Injectable()
export class ModelVisibilitiesService extends ModelVisibilitiesServiceCE {
  @TraceCommand({
    entity: MetaTable.MODEL_ROLE_VISIBILITY,
    entityId: (p) => p?.baseId,
    description: visibilityActions.update,
  })
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
