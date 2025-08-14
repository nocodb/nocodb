import { Injectable } from '@nestjs/common';
import { NcApiVersion } from 'nocodb-sdk';
import { BasesV3Service as BasesV3ServiceCE } from 'src/services/v3/bases-v3.service';
import type { NcContext } from '~/interface/config';
import { getFeature, PlanFeatureTypes } from '~/helpers/paymentHelpers';
import { NcError } from '~/helpers/ncError';
import { isOnPrem } from '~/utils';
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

  override async parseBaseRequest(
    context: { workspace_id: string },
    base: any,
  ) {
    if (base.type === 'private') {
      if (
        !(await getFeature(
          PlanFeatureTypes.FEATURE_PRIVATE_BASES,
          context.workspace_id,
        ))
      ) {
        NcError.get({
          api_version: NcApiVersion.V3,
        }).featureNotSupported({
          feature: PlanFeatureTypes.FEATURE_PRIVATE_BASES,
          isOnPrem: isOnPrem,
        });
      }
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
