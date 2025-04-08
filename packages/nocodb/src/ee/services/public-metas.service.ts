import { PublicMetasService as PublicMetasServiceCE } from 'src/services/public-metas.service';
import { Injectable } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import { Workspace } from '~/models';

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
}
