import { PublicMetasService as PublicMetasServiceCE } from 'src/services/public-metas.service';
import { Injectable } from '@nestjs/common';
import {
  AttachmentValidationType,
  DateValidationType,
  ncIsArray,
  NumberValidationType,
  parseProp,
  PlanFeatureTypes,
  SelectValidationType,
  StringValidationType,
  TimeValidationType,
  ViewTypes,
  YearValidationType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { FormView, FormViewColumn } from '~/models';
import { Base, Workspace } from '~/models';
import { NcError } from '~/helpers/catchError';
import { getFeature } from '~/helpers/paymentHelpers';

@Injectable()
export class PublicMetasService extends PublicMetasServiceCE {
  async viewMetaGet(
    context: NcContext,
    param: { sharedViewUuid: string; password: string },
  ) {
    let view = await super.viewMetaGet(context, param);

    const workspace = await Workspace.get(view.fk_workspace_id, false);

    if (view.type === ViewTypes.FORM) {
      view = await this.validateFormViewPlanLimitAndFeatures(view, workspace);
    }

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
    workspace: Workspace,
  ) {
    const isFormFieldOnConditionEnabled = await getFeature(
      PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION,
      workspace,
    );

    const isFormCustomLogEnabled = await getFeature(
      PlanFeatureTypes.FEATURE_FORM_CUSTOM_LOGO,
      workspace,
    );

    const isHideBrandingEnabled = await getFeature(
      PlanFeatureTypes.FEATURE_HIDE_BRANDING,
      workspace,
    );

    const isUrlRedirectionEnabled = await getFeature(
      PlanFeatureTypes.FEATURE_FORM_URL_REDIRECTION,
      workspace,
    );

    const isFieldValidationEnabled = await getFeature(
      PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION,
      workspace,
    );

    const formView = view.view as FormView;

    const formColumns = isFieldValidationEnabled
      ? view.columns
      : (view.columns as FormViewColumn[]).map((c) => {
          if (!ncIsArray((c.meta as Record<string, any>)?.validators)) return c;

          const validators = (c.meta as Record<string, any>)?.validators.filter(
            (val) => {
              // Restrict number validation type
              if (Object.values(NumberValidationType).includes(val.type)) {
                return false;
              }

              // Restrict date, time, year ranage validation
              if (
                Object.values(DateValidationType).includes(val.type) ||
                Object.values(TimeValidationType).includes(val.type) ||
                Object.values(YearValidationType).includes(val.type)
              ) {
                return false;
              }

              // Restrict attachment valiation
              if (Object.values(AttachmentValidationType).includes(val.type)) {
                return false;
              }

              // From select validation restrict only range validation, limit options is by default enabled
              if (
                [
                  SelectValidationType.MinSelected,
                  SelectValidationType.MaxSelected,
                ].includes(val.type)
              ) {
                return false;
              }

              // From string validation restrict only custom validation (email, url, phonenumber is default column validation)
              if (
                Object.values(StringValidationType)
                  .filter(
                    (v) =>
                      ![
                        StringValidationType.Email,
                        StringValidationType.Url,
                        StringValidationType.PhoneNumber,
                      ].includes(v),
                  )
                  .includes(val.type)
              ) {
                return false;
              }

              return true;
            },
          );

          c.meta = { ...(c.meta as Record<string, any>), validators };

          return c;
        });

    Object.assign(view, {
      ...view,
      columns: formColumns,
      filter: isFormFieldOnConditionEnabled ? view.filter : {},
      view: {
        ...formView,
        banner_image_url: isFormCustomLogEnabled
          ? formView.banner_image_url
          : null,
        logo_url: isFormCustomLogEnabled ? formView.logo_url : null,
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
