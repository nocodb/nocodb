import { Injectable, Logger } from '@nestjs/common';
import { parseProp, ViewTypes } from 'nocodb-sdk';
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
import { Sort, View } from '~/models';
import {
  builderGenerator,
  viewColumnBuilder,
} from '~/utils/api-v3-data-transformation.builder';
import { ViewsService } from '~/services/views.service';
import { NcError } from '~/helpers/catchError';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';
import { SortsV3Service } from '~/services/v3/sorts-v3.service';
import { validatePayload } from '~/helpers';

// cannot use viewTypeAlias due to uppercase
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
      mappings: {},
      meta: {
        mappings: {
          allowCSVDownload: 'allow_csv_download',
        },
        skipTransformFor: ['allowCSVDownload'],
      },
      excludeEmptyObjectProps: true,
      transformFn: (viewData) => {
        const { view, ...formattedData } = viewData;
        formattedData.type = viewTypeMap[formattedData.type];

        if (view) {
          // JSON stringify + parse again to remove all undefined child props
          formattedData.options = JSON.parse(
            JSON.stringify(
              this.viewOptionsBuilder().build(formattedData.view) ?? {},
            ),
          );
        }

        // if description empty then set it to undefined
        if (!formattedData.description) {
          formattedData.description = undefined;
        }

        // if meta empty then set it to undefined
        if (!formattedData.meta || !Object.keys(formattedData.meta).length) {
          formattedData.meta = undefined;
        }

        if (Object.keys(formattedData.options ?? {}).length === 0) {
          formattedData.options = undefined;
        }

        formattedData.is_default = !formattedData.is_default
          ? undefined
          : formattedData.is_default;
        return formattedData;
      },
    });

    this.viewBuilder = builderGenerator({
      allowed: [
        'id',
        'title',
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
        title: 'name',
      },
      excludeEmptyObjectProps: true,
      transformFn: (viewData) => {
        const { view, ...formattedData } = viewData;
        formattedData.type = viewTypeMap[formattedData.type];
        const options = JSON.parse(
          JSON.stringify(this.viewOptionsBuilder().build(view)),
        );

        if (Object.keys(options).length > 0) {
          formattedData.options = options;
        }
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
        'meta',
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

        if (formattedData?.calendar_range?.length) {
          formattedData.dateRanges = formattedData.calendar_range.map(
            (range) => ({
              startDateFieldId: range.fk_from_column_id ?? undefined,
              endDateFieldId: range.fk_to_column_id ?? undefined,
            }),
          );
          formattedData.calendar_range = undefined;
        }
        if (formattedData.kanban_stack_by_field_id) {
          formattedData.stackBy = {
            fieldId: formattedData.kanban_stack_by_field_id,
            stackOrder: (
              parseProp(formattedData.meta ?? {})?.[
                formattedData.kanban_stack_by_field_id
              ] ?? []
            )
              .filter((k) => k.id !== 'uncategorized')
              .map((k) => k.title),
          };
          formattedData.kanban_stack_by_field_id = undefined;
        }

        // if description empty then set it to undefined
        if (!formattedData.description) {
          formattedData.description = undefined;
        }

        formattedData.meta = undefined;

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

        return result;
      },
    }) as any;
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
    const newViews = this.builder().build(views);
    return newViews;
  }

  async getView(context: NcContext, param: { viewId: string; req: NcRequest }) {
    const view = await View.get(context, param.viewId);
    // todo: check for GUI permissions, since we are handling at ui level we can ignore for now

    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    await view.getViewWithInfo(context);

    const formattedView = this.viewBuilder().build(view);

    if (viewTypeMap[view.type] !== ViewTypes.FORM) {
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
    formattedView.is_default = !formattedView.is_default
      ? undefined
      : formattedView.is_default;

    // extract the view specific infos
    switch (viewTypeMap[view.type]) {
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
              fieldId: c.fk_column_id,
              direction: (c as GridViewColumn).group_by_sort,
            }));
          if (group && group.length > 0) {
            formattedView.options = formattedView.options ?? {};
            formattedView.options.groups = group;
          }
        }
        break;
      case ViewTypes.GALLERY:
        {
        }
        break;
      case ViewTypes.KANBAN:
        {
          if (formattedView.options?.stackBy) {
            formattedView.options?.stackBy.meta[
              formattedView.options?.stackBy.fieldId
            ];
            delete formattedView.options?.stackBy.meta;
          }
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
      context,
    );
    if (body.options) {
      const optionsSchemaName =
        'ViewOptions' + body.type[0] + body.type.substring(1).toLowerCase();
      validatePayload(
        `swagger-v3.json#/components/schemas/${optionsSchemaName}`,
        body.options,
        true,
        context,
      );
    }

    let requestBody = this.v3Tov2ViewBuilders.view().build(body);

    const viewTypeCode =
      viewTypeMap[(body.type as any as string).toUpperCase()];
    requestBody.type = viewTypeCode;
    requestBody.options = requestBody.options ?? {};
    requestBody = {
      ...requestBody,
      ...this.v3Tov2ViewBuilders.options().build(requestBody.options),
    };

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
            groups = requestBody.options.groups;
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
            const gridColumns = await this.gridColumnsService.columnList(
              context,
              { gridViewId: insertedV2View.id },
              trxNcMeta,
            );
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
                  gridViewColumnId: gridColumns.find(
                    (col) => col.fk_column_id === group.fieldId,
                  ).id,
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
              calendar: requestBody,
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
              kanban: requestBody,
              req: req,
              user: context.user,
            },
            trxNcMeta,
          );
          await this.kanbansService.kanbanOptionsReorder(
            context,
            {
              kanbanViewId: insertedV2View.id,
              optionsOrder: requestBody.options.stackBy.stackOrder ?? [],
              req,
            },
            trxNcMeta,
          );

          requestBody.options.stackBy = undefined;

          break;
        }
        case ViewTypes.GALLERY: {
          insertedV2View = await this.galleriesService.galleryViewCreate(
            context,
            {
              tableId,
              gallery: requestBody,
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
              body: requestBody,
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

  async update(
    context: NcContext,
    param: { req: NcRequest; viewId: string },
    ncMeta?: MetaService,
  ) {
    const { req, viewId } = param;
    const { body } = req;

    validatePayload(
      'swagger-v3.json#/components/schemas/ViewUpdate',
      body,
      true,
      context,
    );

    const existingView = await View.get(context, viewId, ncMeta);
    if (!existingView) {
      NcError.get(context).viewNotFound(viewId);
    }
    if (body.options) {
      const viewTypeStr = viewTypeMap[existingView.type];
      const optionsSchemaName =
        'ViewOptions' + viewTypeStr[0] + viewTypeStr.substring(1).toLowerCase();
      validatePayload(
        `swagger-v3.json#/components/schemas/${optionsSchemaName}`,
        body.options,
        true,
        context,
      );
    }

    let requestBody = this.v3Tov2ViewBuilders.view().build(body);

    requestBody.options = requestBody.options ?? {};
    requestBody = {
      ...requestBody,
      ...this.v3Tov2ViewBuilders.options().build(requestBody.options),
    };

    const trxNcMeta = ncMeta ? ncMeta : await Noco.ncMeta.startTransaction();
    try {
      await this.viewsService.viewUpdate(context, {
        viewId,
        view: requestBody,
        user: context.user,
        req,
      });

      switch (existingView.type) {
        case ViewTypes.GRID: {
          let groups: any[];
          if (
            requestBody.options.groups &&
            Array.isArray(requestBody.options.groups)
          ) {
            if (requestBody.options.groups.length > 3) {
              NcError.get(context).invalidRequestBody(
                `options.groups maximal 3 fields`,
              );
            }
            groups = requestBody.options.groups;
          }
          await this.gridsService.gridViewUpdate(
            context,
            {
              grid: requestBody,
              req: req,
              viewId,
            },
            trxNcMeta,
          );
          if (groups && Array.isArray(groups)) {
            await this.gridColumnsService.gridColumnClearGroupBy(
              context,
              { viewId },
              trxNcMeta,
            );
            if (groups.length > 0) {
              const gridColumns = await this.gridColumnsService.columnList(
                context,
                { gridViewId: viewId },
                trxNcMeta,
              );
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
                    gridViewColumnId: gridColumns.find(
                      (col) => col.fk_column_id === group.fieldId,
                    ).id,
                    req,
                  },
                  trxNcMeta,
                );
              }
            }
          }
          break;
        }
        case ViewTypes.CALENDAR: {
          await this.calendarsService.calendarViewUpdate(
            context,
            {
              calendar: requestBody,
              req: req,
              calendarViewId: viewId,
            },
            trxNcMeta,
          );
          break;
        }
        case ViewTypes.KANBAN: {
          await this.kanbansService.kanbanViewUpdate(
            context,
            {
              kanbanViewId: viewId,
              kanban: requestBody,
              req: req,
            },
            trxNcMeta,
          );
          break;
        }
        case ViewTypes.GALLERY: {
          await this.galleriesService.galleryViewUpdate(
            context,
            {
              galleryViewId: viewId,
              gallery: requestBody,
              req: req,
            },
            trxNcMeta,
          );
          break;
        }
        case ViewTypes.FORM: {
          await this.formsService.formViewUpdate(
            context,
            {
              formViewId: viewId,
              form: requestBody,
              req: req,
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

      // if sort is empty array, we clear sort
      if (requestBody.sorts && Array.isArray(requestBody.sorts)) {
        await Sort.deleteAll(context, viewId, trxNcMeta);
        for (const sort of requestBody.sorts) {
          await this.sortsV3Service.sortCreate(
            context,
            {
              viewId,
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
      return this.getView(context, { viewId, req });
    } catch (ex) {
      await trxNcMeta.rollback();
      throw ex;
    }
  }
}
