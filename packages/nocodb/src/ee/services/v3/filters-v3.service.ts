import { Injectable } from '@nestjs/common';
import { FiltersV3Service as FiltersV3ServiceCE } from 'src/services/v3/filters-v3.service';

// Re-export CE helpers so callers that import from '~/services/v3/filters-v3.service'
// (which resolves to this EE file in EE mode) still get them.
export { addDummyRootAndNest } from 'src/services/v3/filters-v3.service';
import type { FilterCreateV3Type } from 'nocodb-sdk';
import type { UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { FilterCreateV3Contract } from '~/command-registry/operations/filters-v3.operations';

@Injectable()
export class FiltersV3Service extends FiltersV3ServiceCE {
  @TraceCommand(FilterCreateV3Contract)
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
}
