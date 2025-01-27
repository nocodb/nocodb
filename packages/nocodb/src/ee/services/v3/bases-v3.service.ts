import { Injectable } from '@nestjs/common';
import { BasesV3Service as BasesV3ServiceCE } from 'src/services/v3/bases-v3.service';
import type { NcContext } from '~/interface/config';
import { Base } from '~/models';
import { BasesService } from '~/services/bases.service';

@Injectable()
export class BasesV3Service extends BasesV3ServiceCE {
  constructor(protected basesService: BasesService) {
    super(basesService);
  }

  protected async getBaseList(
    context: NcContext,
    param: {
      user: { id: string; roles?: string | Record<string, boolean> };
      query?: any;
      workspaceId: string;
    },
  ) {
    const bases = await Base.listByWorkspaceAndUser(
      param.workspaceId,
      param.user.id,
    );

    return bases;
  }
}
