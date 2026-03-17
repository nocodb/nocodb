import { PublicMetasService as PublicMetasServiceCE } from 'src/services/public-metas.service';
import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
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
import { ViewRowColorService } from './view-row-color.service';
import type { CalendarRange, FormView, FormViewColumn, View } from '~/models';
import { NcContext } from '~/interface/config';
import { EEOnly } from '~/decorators/ee-only.decorator';
import {
  Base,
  Column,
  Dashboard,
  Model,
  Permission,
  Workspace,
} from '~/models';
import ListViewLevel from '~/models/ListViewLevel';
import { NcError } from '~/helpers/catchError';
import { getFeature } from '~/helpers/paymentHelpers';
import { isOnPrem } from '~/utils/constants';

@Injectable()
export class PublicMetasService extends PublicMetasServiceCE {
  constructor(private readonly viewRowColorService: ViewRowColorService) {
    super();
  }

  @EEOnly()
  async viewMetaGet(
    context: NcContext,
    param: { sharedViewUuid: string; password: string },
  ) {
    let view = await super.viewMetaGet(context, param);

    const workspace = await Workspace.get(view.fk_workspace_id, false);

    const base = await Base.get(context, view.base_id);

    if (view.type === ViewTypes.FORM) {
      view = await this.validateFormViewPlanLimitAndFeatures(view, workspace);
    }

    if (view.type === ViewTypes.CALENDAR) {
      view = await this.validateCalendarViewPlanLimitAndFeatures(
        view,
        workspace,
      );
    }

    // List view: load level table metas and merge level table columns into view.model.columns
    if (view.type === ViewTypes.LIST) {
      const levels = await ListViewLevel.list(context, view.id);
      const relatedMetas = view.relatedMetas || {};
      for (const level of levels) {
        if (level.fk_model_id && !relatedMetas[level.fk_model_id]) {
          const levelModel = await Model.getWithInfo(context, {
            id: level.fk_model_id,
          });
          if (levelModel) {
            relatedMetas[level.fk_model_id] = levelModel;
            // Also extract related metas for this level's columns
            for (const col of levelModel.columns) {
              await this.extractRelatedMetas(context, {
                col,
                relatedMetas,
              });
            }
          }
        }
      }
      view.relatedMetas = relatedMetas;

      // The CE viewMetaGet only merges base table columns into
      // view.model.columns (non-base-table columns get filtered out).
      // Add level table columns back by merging view column data
      // with level table column data.
      for (const level of levels) {
        if (
          !level.fk_model_id ||
          level.fk_model_id === view.fk_model_id ||
          !relatedMetas[level.fk_model_id]
        ) {
          continue;
        }

        const levelModel = relatedMetas[level.fk_model_id];
        const levelColumnsById: Record<string, any> = {};
        for (const col of levelModel.columns || []) {
          if (col.id) levelColumnsById[col.id] = col;
        }

        // view.columns still has ALL view column configs from getColumns()
        const levelViewCols = (view.columns || []).filter(
          (vc) => vc.fk_column_id && levelColumnsById[vc.fk_column_id],
        );

        for (const vc of levelViewCols) {
          const column = levelColumnsById[vc.fk_column_id];
          if (!column) continue;

          if (
            vc.show ||
            (column.rqd && !column.cdf && !column.ai) ||
            column.pk
          ) {
            (view.model.columns as any[]).push(
              new Column({
                ...vc,
                ...column,
              } as any),
            );
          }
        }
      }
    }

    this.checkViewBaseType(view, base);

    const viewRowColorInfo = await this.viewRowColorService.getByViewId({
      context,
      fk_view_id: view.id,
    });

    Object.assign(view, {
      workspace,
      viewRowColorInfo,
    });

    const basePermissions = await Permission.list(context, view.base_id);

    Object.assign(view, {
      basePermissions,
    });

    return view;
  }

  async dashboardMetaGet(
    context: NcContext,
    param: { sharedDashboardUuid: string; password: string },
  ) {
    const dashboard = await Dashboard.getByUUID(
      context,
      param.sharedDashboardUuid,
    );

    if (!dashboard) {
      NcError.dashboardNotFound(param.sharedDashboardUuid);
    }

    if (!(await Dashboard.verifyPassword(dashboard, param.password))) {
      return NcError.invalidSharedDashboardPassword();
    }

    const base = await Base.get(context, dashboard.base_id);

    this.checkViewBaseType(dashboard, base);

    await dashboard.getWidgets(context);

    return dashboard;
  }

  public checkViewBaseType(view: View | Dashboard, base: Base) {
    if (view instanceof Dashboard) {
      if (base.default_role) {
        NcError.notFound(
          'The shared dashboard feature is not available for private bases. Please contact the base owner to request access.',
        );
      }
      return;
    }
    // block non-meta views in private base
    if (view.type !== ViewTypes.FORM && base.default_role) {
      NcError.notFound(
        'The shared view feature is not available for private bases. Please contact the base owner to request access.',
      );
    }
  }

  async publicSharedBaseGet(
    context: NcContext,
    param: { sharedBaseUuid: string },
  ): Promise<any> {
    const base = await Base.getByUuid(context, param.sharedBaseUuid);

    if (!base) {
      NcError.baseNotFound(param.sharedBaseUuid);
    }
    this.checkBaseType(base);

    const workspace = await Workspace.get(base.fk_workspace_id, false);

    return {
      base_id: base.id,
      base_title: base.title,
      workspace,
    };
  }

  public checkBaseType(base: Base) {
    // block shared base for private base
    if (base.default_role) {
      NcError.notFound(
        'The shared base feature is not available for private bases. Please contact the base owner to request access.',
      );
    }
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

    const isUrlRedirectionEnabled =
      isOnPrem ||
      (await getFeature(
        PlanFeatureTypes.FEATURE_FORM_URL_REDIRECTION,
        workspace,
      ));

    const isFieldValidationEnabled = await getFeature(
      PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION,
      workspace,
    );

    const isFormSchedulingEnabled =
      isOnPrem ||
      (await getFeature(PlanFeatureTypes.FEATURE_FORM_SCHEDULING, workspace));

    const formView = view.view as FormView;

    // Check if form hasn't started yet
    if (isFormSchedulingEnabled && formView.starts_at) {
      if (dayjs.utc(formView.starts_at).isAfter(dayjs.utc())) {
        Object.assign(view, {
          ...view,
          is_form_not_started: true,
          form_starts_at: formView.starts_at,
        });
        return view;
      }
    }

    // Check if form has expired
    if (isFormSchedulingEnabled && formView.expires_at) {
      if (dayjs.utc(formView.expires_at).isBefore(dayjs.utc())) {
        Object.assign(view, {
          ...view,
          is_form_expired: true,
        });
        return view;
      }
    }

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
        starts_at: isFormSchedulingEnabled ? formView.starts_at : null,
        expires_at: isFormSchedulingEnabled ? formView.expires_at : null,
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

  async validateCalendarViewPlanLimitAndFeatures(
    view: Awaited<
      ReturnType<typeof PublicMetasServiceCE.prototype.viewMetaGet>
    >,
    workspace: Workspace,
  ) {
    const isCalendarEndDateEnabled = await getFeature(
      PlanFeatureTypes.FEATURE_CALENDAR_RANGE,
      workspace,
    );

    const calendarView = view.view as any;

    const calendarRanges = (calendarView.calendar_range ||
      []) as CalendarRange[];
    const calendarRangesWithEndDate = calendarRanges.map((range) => {
      if (isCalendarEndDateEnabled || !range.fk_to_column_id) {
        return range;
      } else if (range.fk_to_column_id) {
        return {
          ...range,
          fk_to_column_id: null,
        };
      }
    });

    Object.assign(view, {
      ...view,
      view: {
        ...calendarView,
        calendar_range: calendarRangesWithEndDate,
      },
    });
    return view;
  }
}
