import { Injectable } from '@nestjs/common';
import { FiltersV3Service as FiltersV3ServiceCE } from 'src/services/v3/filters-v3.service';

// Re-export CE helpers so callers that import from '~/services/v3/filters-v3.service'
// (which resolves to this EE file in EE mode) still get them.
export { addDummyRootAndNest } from 'src/services/v3/filters-v3.service';
import type { FilterCreateV3Type } from 'nocodb-sdk';
import type { UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { NcContext } from '~/interface/config';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';

@Injectable()
export class FiltersV3Service extends FiltersV3ServiceCE {
  @TraceCommand(OperationName.filterCreateV3)
  async filterCreate(
    context: NcContext,
    param: {
      filter: FilterCreateV3Type;
      user: UserType;
      req: NcRequest;
    } & { viewId: string },
  ) {
    return super.filterCreate(context, param);
  }

  @TraceCommand(OperationName.filterReplaceV3)
  async filterReplace(
    context: NcContext,
    param: {
      filter: FilterCreateV3Type;
      user: UserType & {
        base_roles?: Record<string, boolean>;
        workspace_roles?: Record<string, boolean>;
        provider?: string;
      };
      req: NcRequest;
    } & { viewId: string },
  ) {
    return super.filterReplace(context, param);
  }

  @TraceCommand(OperationName.filterDeleteAllV3)
  async filterDeleteAll(
    context: NcContext,
    param: { viewId: string },
    ncMeta?: MetaService,
  ) {
    return super.filterDeleteAll(context, param, ncMeta);
  }
}
