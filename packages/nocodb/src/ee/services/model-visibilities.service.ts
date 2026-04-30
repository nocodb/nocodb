import { Injectable } from '@nestjs/common';
import { ModelVisibilitiesService as ModelVisibilitiesServiceCE } from 'src/services/model-visibilities.service';
import type { VisibilityRuleReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { OperationName } from '~/command-registry/_op-names';
import { NcContext } from '~/interface/config';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { assertNotSandbox } from '~/helpers/sandboxGuards';

@Injectable()
export class ModelVisibilitiesService extends ModelVisibilitiesServiceCE {
  @TraceCommand(OperationName.visibilityUpdate)
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
