import { PublicMetasService as PublicMetasServiceCE } from 'src/services/public-metas.service';
import { Injectable } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import { Base, Workspace } from '~/models';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class PublicMetasService extends PublicMetasServiceCE {
  async viewMetaGet(
    context: NcContext,
    param: { sharedViewUuid: string; password: string },
  ) {
    const view = await super.viewMetaGet(context, param);

    const workspace = await Workspace.get(view.fk_workspace_id, false);

    Object.assign(view, {
      workspace,
    });

    return view;
  }

  async publicSharedBaseGet(
    context: NcContext,
    param: { sharedBaseUuid: string },
  ): Promise<any> {
    const base = await Base.getByUuid(context, param.sharedBaseUuid);

    if (!base) {
      NcError.baseNotFound(param.sharedBaseUuid);
    }

    const workspace = await Workspace.get(base.fk_workspace_id, false);

    return {
      base_id: base.id,
      workspace,
    };
  }
}
