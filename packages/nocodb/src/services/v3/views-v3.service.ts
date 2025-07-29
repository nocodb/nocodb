import { Injectable, Logger } from '@nestjs/common';
import { viewTypeAlias, ViewTypes } from 'nocodb-sdk';
import { GridsService } from '../grids.service';
import { CalendarsService } from '../calendars.service';
import { KanbansService } from '../kanbans.service';
import { GalleriesService } from '../galleries.service';
import { FormsService } from '../forms.service';
import { GridColumnsService } from '../grid-columns.service';
import type { MetaService } from '~/meta/meta.service';
import type { ApiV3DataTransformationBuilder } from 'src/utils/data-transformation.builder';
import type { NcContext, NcRequest } from '~/interface/config';
import type { GridViewColumn } from '~/models';
import Noco from '~/Noco';
import { View } from '~/models';
import {
  builderGenerator,
  viewColumnBuilder,
} from '~/utils/api-v3-data-transformation.builder';
import { ViewsService } from '~/services/views.service';
import { NcError } from '~/helpers/catchError';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';
import { SortsV3Service } from '~/services/v3/sorts-v3.service';
import { validatePayload } from '~/helpers';

const viewTypeMap = {
  GRID: ViewTypes.GRID,
  GALLERY: ViewTypes.GALLERY,
  KANBAN: ViewTypes.KANBAN,
  CALENDAR: ViewTypes.CALENDAR,
  FORM: ViewTypes.FORM,
  [ViewTypes.GRID]: 'GRID',
  [ViewTypes.GALLERY]: 'GALLERY',
  [ViewTypes.KANBAN]: 'KANBAN',
  [ViewTypes.CALENDAR]: 'CALENDAR',
  [ViewTypes.FORM]: 'FORM',
};
@Injectable()
export class ViewsV3Service {
  protected logger = new Logger(ViewsV3Service.name);
  private builder;
  private viewBuilder;
  private viewOptionsBuilder;
  private v3Tov2ViewBuilders: {
    view?: () => ApiV3DataTransformationBuilder<any, any>;
    options?: () => ApiV3DataTransformationBuilder<any, any>;
  } = {};

  constructor(
    protected readonly viewsService: ViewsService,
    protected filtersV3Service: FiltersV3Service,
    protected sortsV3Service: SortsV3Service,
    protected gridsService: GridsService,
    protected gridColumnsService: GridColumnsService,
    protected calendarsService: CalendarsService,
    protected formsService: FormsService,
    protected kanbansService: KanbansService,
    protected galleriesService: GalleriesService,
  ) {
    this.builder = builderGenerator({
      allowed: [
        'id',
        'view_name',
        'view_type',
        'lock_type',
        'description',
        'is_default',
        'meta',
        'locked_view_description',
        'locked_by_user_id',
        'created_by',
        'owned_by',
        'created_at',
        'updated_at',
        'view',
        'type',
      ],
      mappings: {
        type: 'view_type',
      },
      meta: {
        mappings: {
          allowCSVDownload: 'allow_csv_download',
        },
        skipTransformFor: ['allowCSVDownload'],
      },
      transformFn: (viewData) => {
        const { view, ...formattedData } = viewData;
        formattedData.view_type = viewTypeAlias[formattedData.view_type];

        if (view) {
          // handle view specific data
        }

        // if description empty then set it to undefined
        if (!formattedData.description) {
          formattedData.description = undefined;
        }

        // if meta empty then set it to undefined
        if (!formattedData.meta || !Object.keys(formattedData.meta).length) {
          formattedData.meta = undefined;
        }

        return formattedData;
      },
    });

    this.viewBuilder = builderGenerator({
      allowed: [
        'id',
        'view_name',
        'view_type',
        'lock_type',
        'description',
        'is_default',
        'meta',
        'locked_view_description',
        'locked_by_user_id',
        'created_by',
        'owned_by',
        'created_at',
        'updated_at',
        'view',
        'type',
      ],
      mappings: {},
      transformFn: (viewData) => {
        const formattedData = viewData;
        formattedData.view_type = viewTypeAlias[formattedData.view_type];
        const options = this.viewOptionsBuilder().build(formattedData.view);
        if (Object.keys(options).length > 0) {
          formattedData.options = options;
        }
        delete formattedData.view;
        return formattedData;
      },
    });
    this.viewOptionsBuilder = builderGenerator({
      allowed: [
        'heading',
        'subheading',
        'success_msg',
        'redirect_url',
        'redirect_after_secs',
        'email',
        'submit_another_form',
        'show_blank_form',
        'hide_banner',
        'hide_branding',
        'banner_image_url',
        'logo_url',
        'background_color',
        'fk_cover_image_col_id',
        'fk_grp_col_id',
      ],
      mappings: {
        heading: 'formTitle',
        subheading: 'formDescription',
        success_msg: 'thankYouMessage',
        redirect_after_secs: 'form_redirect_after_secs',
        email: 'form_send_response_email',
        submit_another_form: 'submitAnotherForm',
        show_blank_form: 'showBlankForm',
        hide_banner: 'form_hide_banner',
        hide_branding: 'form_hide_branding',
        banner_image_url: 'form_banner_image_url',
        logo_url: 'form_logo_url',
        background_color: 'form_background_color',

        fk_cover_image_col_id: 'cover_image_field_id',
        fk_grp_col_id: 'kanban_stack_by_field_id',
      },
      booleanProps: ['submit_another_form', 'show_blank_form'],
      nestedExtract: {
        form_hide_branding: ['view', 'meta', 'hide_branding'],
        background_color: ['view', 'meta', 'background_color'],
        form_hide_banner: ['view', 'meta', 'hide_banner'],
      },
      transformFn: (viewData) => {
        const formattedData = viewData;
        formattedData.view_type = viewTypeAlias[formattedData.view_type];

        if (formattedData?.calendar_range?.length) {
          formattedData.dateRanges = formattedData.calendar_range.map(
            (range) => ({
              startDateFieldId: range.fk_from_column_id ?? undefined,
              endDateFieldId: range.fk_to_column_id ?? undefined,
            }),
          );
          formattedData.calendar_range = undefined;
        }

        // if description empty then set it to undefined
        if (!formattedData.description) {
          formattedData.description = undefined;
        }

        // if meta empty then set it to undefined
        if (!formattedData.meta || !Object.keys(formattedData.meta).length) {
          formattedData.meta = undefined;
        }

        if (formattedData.redirect_url) {
          formattedData.redirectOnSubmit = {
            url: formattedData.redirect_url,
          };
          formattedData.redirect_url = undefined;
        }

        return formattedData;
      },
    });

    this.v3Tov2ViewBuilders.view = builderGenerator<any, any>({
      allowed: [
        'id',
        'type',
        'name',
        'description',
        'sorts',
        'groups',
        'options',
        'meta',
        'created_by',
        'owned_by',
        'created_at',
        'updated_at',
      ],
      mappings: {
        name: 'title',
      },
      booleanProps: ['submit_another_form', 'show_blank_form'],
      nestedExtract: {
        form_hide_branding: ['view', 'meta', 'hide_branding'],
        background_color: ['view', 'meta', 'background_color'],
        form_hide_banner: ['view', 'meta', 'hide_banner'],
      },
      transformFn: (viewData) => {
        return viewData;
      },
    }) as any;

    this.v3Tov2ViewBuilders.options = builderGenerator<any, any>({
      allowed: [
        // calendar
        'dateRanges',

        // kanban
        'stackBy',

        // gallery
        'coverFieldId',

        // form
        'formTitle',
        'formDescription',
        'submitButtonLabel',
        'thankYouMessage',
        'redirectOnSubmit',
        'submitAnotherForm',
        'showBlankForm',
      ],
      mappings: {
        // calendar
        dateRanges: 'calendar_range',

        // gallery
        coverFieldId: 'fk_cover_image_col_id',

        // form
        formTitle: 'heading',
        formDescription: 'subheading',
        thankYouMessage: 'success_msg',
        submitAnotherForm: 'submit_another_form',
        showBlankForm: 'show_blank_form',
      },
      transformFn: (options) => {
        const result = {
          ...options,
          // calendar
          ...(options.calendar_range?.length ?? 0 > 0
            ? {
                calendar_range: options.calendar_range.map((range) => ({
                  fk_from_column_id: range.startDateFieldId,
                  fk_to_column_id: range.endDateFieldId,
                })),
              }
            : {}),
          // kanban
          ...(options.stackBy?.fieldId
            ? { fk_grp_col_id: options.stackBy.fieldId }
            : {}),
        };

        options.stackBy = undefined;
        return result;
      },
    }) as any;

    /**
     {
      "submit_another_form": false,
      "show_blank_form": false,
      "meta": {
        "hide_branding": false,
        "background_color": "#F9F9FA",
        "hide_banner": false
      }
    }

    "formTitle": "Submit Ticket",
    "formDescription": "We'll get back to you soon.",
    "submitButtonLabel": "Submit",
    "thankYouMessage": "Thanks for your response!",
    "redirectOnSubmit": {
      "enabled": true,
      "url": "https://example.com/thank-you"
    }
     */
  }

  async getViews(
    context: NcContext,
    param: {
      tableId: string;
      req: NcRequest;
    },
  ) {
    const views = await this.viewsService.viewList(context, {
      tableId: param.tableId,
      user: param.req.user,
    });

    return this.builder().build(views);
  }

  async getView(context: NcContext, param: { viewId: string; req: NcRequest }) {
    const view = await View.get(context, param.viewId);

    // todo: check for GUI permissions, since we are handling at ui level we can ignore for now

    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    await view.getViewWithInfo(context);

    const formattedView = this.viewBuilder().build(view);

    if (view.type !== ViewTypes.FORM) {
      // get filters
      const filters = await this.filtersV3Service.filterList(context, {
        viewId: view.id,
      });

      formattedView.filters = filters?.length ? filters : undefined;

      // get sorts
      const sorts = await this.sortsV3Service.sortList(context, {
        viewId: view.id,
      });

      formattedView.sorts = sorts?.length ? sorts : undefined;
    }

    const viewColumnList = await View.getColumns(context, view.id);

    formattedView.fields = viewColumnBuilder().build(viewColumnList);

    // extract the view specific infos
    switch (view.type) {
      case ViewTypes.GRID:
        {
          // extract grid specific group by info
          const group = viewColumnList
            .filter((c) => (c as GridViewColumn).group_by)
            .sort(
              (c1, c2) =>
                ((c1 as GridViewColumn).group_by_order || Infinity) -
                ((c2 as GridViewColumn).group_by_order || Infinity),
            )
            .map((c) => ({
              field_id: c.fk_column_id,
              sort: (c as GridViewColumn).group_by_sort,
            }));
          formattedView.group = group;
        }
        break;
      case ViewTypes.GALLERY:
        {
        }
        break;
      case ViewTypes.KANBAN:
        {
        }
        break;
      case ViewTypes.FORM:
        {
        }
        break;
      case ViewTypes.CALENDAR:
        {
        }
        break;
    }

    // group info
    formattedView.type = viewTypeMap[formattedView.type];
    return formattedView;
  }

  async create(
    context: NcContext,
    param: { req: NcRequest; tableId: string },
    ncMeta?: MetaService,
  ) {
    const { req, tableId } = param;
    const { body } = req;

    validatePayload(
      'swagger-v3.json#/components/schemas/ViewCreate',
      body,
      true,
    );
    const requestBody = this.v3Tov2ViewBuilders.view().build(body);

    requestBody.type =
      viewTypeMap[(requestBody.type as any as string).toUpperCase()];
    requestBody.options = requestBody.options ?? {};

    const trxNcMeta = ncMeta ? ncMeta : await Noco.ncMeta.startTransaction();
    try {
      let insertedV2View: View;
      switch (requestBody.type) {
        case ViewTypes.GRID: {
          let groups: any[];
          if (
            requestBody.options.groups &&
            requestBody.options.groups.length > 0
          ) {
            if (requestBody.options.groups.length > 3) {
              NcError.get(context).invalidRequestBody(
                `options.groups maximal 3 fields`,
              );
            }
            groups = requestBody.options;
          }
          insertedV2View = await this.gridsService.gridViewCreate(
            context,
            {
              tableId,
              grid: requestBody,
              req: req,
            },
            trxNcMeta,
          );
          if (groups && groups.length > 0) {
            let order = 1;
            for (const group of groups) {
              await this.gridColumnsService.gridColumnUpdate(
                context,
                {
                  grid: {
                    group_by: true,
                    group_by_order: order++,
                    group_by_sort: group.direction,
                  },
                  gridViewColumnId: group.field,
                  req,
                },
                trxNcMeta,
              );
            }
          }
          break;
        }
        case ViewTypes.CALENDAR: {
          insertedV2View = await this.calendarsService.calendarViewCreate(
            context,
            {
              tableId,
              calendar: {
                ...requestBody,
                ...this.v3Tov2ViewBuilders.options().build(requestBody.options),
              },
              req: req,
              user: context.user,
            },
            trxNcMeta,
          );
          break;
        }
        case ViewTypes.KANBAN: {
          insertedV2View = await this.kanbansService.kanbanViewCreate(
            context,
            {
              tableId,
              kanban: {
                ...requestBody,
                ...this.v3Tov2ViewBuilders.options().build(requestBody.options),
              },
              req: req,
              user: context.user,
            },
            trxNcMeta,
          );
          break;
        }
        case ViewTypes.GALLERY: {
          insertedV2View = await this.galleriesService.galleryViewCreate(
            context,
            {
              tableId,
              gallery: {
                ...requestBody,
                ...this.v3Tov2ViewBuilders.options().build(requestBody.options),
              },
              req: req,
              user: context.user,
            },
            trxNcMeta,
          );
          break;
        }
        case ViewTypes.FORM: {
          insertedV2View = await this.formsService.formViewCreate(
            context,
            {
              tableId,
              body: {
                ...requestBody,
                ...this.v3Tov2ViewBuilders.options().build(requestBody.options),
              },
              req: req,
              user: context.user,
            },
            trxNcMeta,
          );
          break;
        }
        default: {
          NcError.get(context).invalidRequestBody(
            `Type ${requestBody.type} is not supported`,
          );
          break;
        }
      }

      if (requestBody.sorts && requestBody.sorts.length > 0) {
        for (const sort of requestBody.sorts) {
          await this.sortsV3Service.sortCreate(
            context,
            {
              viewId: insertedV2View.id,
              req,
              sort,
            },
            trxNcMeta,
          );
        }
      }

      if (!ncMeta) {
        await trxNcMeta.commit();
      }
      return this.getView(context, { viewId: insertedV2View.id, req });
    } catch (ex) {
      await trxNcMeta.rollback();
      throw ex;
    }
  }
}
