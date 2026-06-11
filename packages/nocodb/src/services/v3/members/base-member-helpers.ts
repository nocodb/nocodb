import type { NcContext } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import { NcError } from '~/helpers/ncError';

export class BaseMemberHelpers {
  constructor() {}

  async getBaseMember(
    context: NcContext,
    _param: {
      baseId: string;
      isPrivateBase?: boolean;
    },
    _ncMeta?: MetaService,
  ): Promise<{
    individual_members: { base_members: any[]; workspace_members: any[] };
  }> {
    NcError.get(context).invalidRequestBody(
      'Accessing member management api is only available on paid plans. Please upgrade your workspace plan to enable this feature.',
    );
    return undefined;
  }
}
