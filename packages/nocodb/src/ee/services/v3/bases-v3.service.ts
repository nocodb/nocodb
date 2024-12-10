import { Injectable } from '@nestjs/common';
import { BasesV3Service as BasesV3ServiceCE } from 'src/services/v3/bases-v3.service';
import type { NcContext } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BaseUser } from '~/models';
import { MetaService } from '~/meta/meta.service';
import { TablesService } from '~/services/tables.service';

import { NcError } from '~/helpers/catchError';
import { BasesService } from '~/services/bases.service';

@Injectable()
export class BasesV3Service extends BasesV3ServiceCE {
  constructor(
    protected basesService: BasesService,
  ) {
    super( basesService);
  }

  protected async getBaseList(
    context: NcContext,
    param: {
      user: { id: string; roles?: string | Record<string, boolean> };
      query?: any;
    },
  ) {
    if (!param.query.workspace_id) {
      NcError.badRequest('Missing workspace_id query param');
    }

    const bases = await BaseUser.getProjectsList(param.user.id, param.query);

    return bases;
  }
}
