import { PublicMetasService as PublicMetasServiceCE } from 'src/services/public-metas.service';
import { Injectable } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import { Base, FormView, Workspace } from '~/models';
import { NcError } from '~/helpers/catchError';
import { parseProp, PlanFeatureTypes, ViewTypes } from 'nocodb-sdk';
import { getFeature } from '~/helpers/paymentHelpers';

@Injectable()
export class PublicMetasService extends PublicMetasServiceCE {
  async viewMetaGet(
    context: NcContext,
    param: { sharedViewUuid: string; password: string },
  ) {
    let view = await super.viewMetaGet(context, param);

    if (view.type === ViewTypes.FORM) {
      view = await this.validateFormViewPlanLimitAndFeatures(view);
    }

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

  async validateFormViewPlanLimitAndFeatures(
    view: Awaited<
      ReturnType<typeof PublicMetasServiceCE.prototype.viewMetaGet>
    >,
  ) {
    const isFormFieldOnConditionEnabled = await getFeature(
      PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION,
      view.fk_workspace_id,
    );

    const isFormCustomLogEnabled = await getFeature(
      PlanFeatureTypes.FEATURE_FORM_CUSTOM_LOGO,
      view.fk_workspace_id,
    );

    const isHideBrandingEnabled = await getFeature(
      PlanFeatureTypes.FEATURE_HIDE_BRANDING,
      view.fk_workspace_id,
    );
    const isUrlRedirectionEnabled = await getFeature(
      PlanFeatureTypes.FEATURE_FORM_URL_REDIRECTION,
      view.fk_workspace_id,
    );

    const formView = view.view as FormView;

    Object.assign(view, {
      ...view,
      filter: isFormFieldOnConditionEnabled ? view.filter : {},
      view: {
        ...formView,
        banner_image_url: isFormCustomLogEnabled
          ? formView.banner_image_url
          : null,
        logo_url: isFormCustomLogEnabled ? formView.banner_image_url : null,
        redirect_url: isUrlRedirectionEnabled ? formView.redirect_url : null,
        meta: {
          ...parseProp(formView.meta),
          hide_banner: isHideBrandingEnabled
            ? parseProp(formView.meta).hide_banner
            : false,
          hide_branding: isHideBrandingEnabled
            ? parseProp(formView.meta).hide_branding
            : false,
        },
      },
    });
    return view;
  }
}
