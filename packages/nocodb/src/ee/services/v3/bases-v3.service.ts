import { Injectable } from '@nestjs/common';
import { NcApiVersion } from 'nocodb-sdk';
import { BasesV3Service as BasesV3ServiceCE } from 'src/services/v3/bases-v3.service';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/ncError';
import { checkForFeature, PlanFeatureTypes } from '~/helpers/paymentHelpers';
import { getPatResourceFilter } from '~/helpers/patResourceFilter';
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
      req?: NcRequest;
    },
  ) {
    const bases = await Base.listByWorkspaceAndUser(
      param.workspaceId,
      param.user.id,
    );

    const patFilter = param.req
      ? await getPatResourceFilter(param.req)
      : null;
    if (!patFilter) return bases;

    return bases.filter(
      (b: any) =>
        patFilter.baseIds.includes(b.id) ||
        patFilter.workspaceIds.includes(b.fk_workspace_id),
    );
  }

  override async parseBaseRequest(
    context: { workspace_id: string },
    base: any,
  ) {
    if (base.type === 'private') {
      await checkForFeature(context, PlanFeatureTypes.FEATURE_PRIVATE_BASES);
    }
    if (base.type && !['default', 'private'].includes(base.type)) {
      NcError.get({
        api_version: NcApiVersion.V3,
      }).invalidRequestBody(
        `type property value is invalid. Allowed: 'default', 'private'`,
      );
    }
    return (
      base.type && base.type === 'private'
        ? {
            default_role: 'no-access',
          }
        : base.type === 'default'
        ? { default_role: null }
        : {}
    ) as any;
  }
}
