import { Injectable, Logger } from '@nestjs/common';
import {
  ncIsNullOrUndefined,
  parseProp,
  RowHeight,
  RowHeightMap,
  viewTypeAlias,
  ViewTypes,
} from 'nocodb-sdk';
import type {
  RowColoringInfo,
  ViewCreateV3Type,
  ViewOptionBaseV3Type,
} from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { ApiV3DataTransformationBuilder } from '~/utils/data-transformation.builder';
import type { NcContext, NcRequest } from '~/interface/config';
import type { Column, GridViewColumn } from '~/models';
import { GridsService } from '~/services/grids.service';
import { CalendarsService } from '~/services/calendars.service';
import { KanbansService } from '~/services/kanbans.service';
import { GalleriesService } from '~/services/galleries.service';
import { FormsService } from '~/services/forms.service';
import { GridColumnsService } from '~/services/grid-columns.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import Noco from '~/Noco';
import { Model, Sort, View } from '~/models';
import {
  builderGenerator,
  viewColumnBuilder,
} from '~/utils/api-v3-data-transformation.builder';
import { ViewsService } from '~/services/views.service';
import { NcError } from '~/helpers/catchError';
import {
  addDummyRootAndNest,
  FiltersV3Service,
} from '~/services/v3/filters-v3.service';
import { SortsV3Service } from '~/services/v3/sorts-v3.service';
import { validatePayload } from '~/helpers';
import { FormColumnsService } from '~/services/form-columns.service';
import { ViewRowColorService } from '~/services/view-row-color.service';
import { withoutId } from '~/helpers/exportImportHelpers';

const viewTypeMap = {
  grid: ViewTypes.GRID,
  gallery: ViewTypes.GALLERY,
  kanban: ViewTypes.KANBAN,
  calendar: ViewTypes.CALENDAR,
  form: ViewTypes.FORM,
  ...viewTypeAlias,
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
    formFieldByIds?: () => ApiV3DataTransformationBuilder<any, any>;
    rowColors?: () => ApiV3DataTransformationBuilder<RowColoringInfo, any>;
  } = {};
  private v2Tov3ViewBuilders: {
    formFieldByIds?: () => ApiV3DataTransformationBuilder<any, any>;
  } = {};

  constructor(
    protected readonly viewsService: ViewsService,
    protected readonly viewColumnsService: ViewColumnsService,
    protected filtersV3Service: FiltersV3Service,
    protected sortsV3Service: SortsV3Service,
    protected viewRowColorService: ViewRowColorService,
    protected gridsService: GridsService,
    protected gridColumnsService: GridColumnsService,
    protected formColumnsService: FormColumnsService,
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
        if (!formattedData.description || formattedData.description === '') {
          formattedData.description = undefined;
        }

        if (Object.keys(formattedData.options ?? {}).length === 0) {
          formattedData.options = undefined;
        }

        if (formattedData.lock_type !== 'personal') {
          formattedData.owned_by = undefined;
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
      mappings: {},
      excludeEmptyObjectProps: true,
      transformFn: (viewData) => {
        const { view, meta, ...formattedData } = viewData;
        formattedData.type = viewTypeMap[formattedData.type];
        const options = JSON.parse(
          JSON.stringify(this.viewOptionsBuilder().build(view)),
        );

        if (formattedData.lock_type !== 'personal') {
          formattedData.owned_by = undefined;
        }

        const { rowColoringInfo: _rowColoringInfo, ...optionMeta } = meta ?? {};
        if (Object.keys(optionMeta ?? {}).length > 0) {
          formattedData.options = {
            ...optionMeta,
          };
        }
        if (Object.keys(options).length > 0) {
          formattedData.options = options;
        }
        // TODO: handle meta
        return formattedData;
      },
    });

    this.viewOptionsBuilder = builderGenerator({
      allowed: [
        // grid
        'row_height',
        // form
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

        'calendar_range',
      ],
      mappings: {
        heading: 'form_title',
        subheading: 'form_description',
        success_msg: 'thank_you_message',
        redirect_after_secs: 'form_redirect_after_secs',
        email: 'send_response_email_to',
        submit_another_form: 'show_submit_another_button',
        show_blank_form: 'reset_form_after_submit',
        hide_banner: 'form_hide_banner',
        hide_branding: 'form_hide_branding',
        banner_image_url: 'banner',
        logo_url: 'logo',
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
          formattedData.date_ranges = formattedData.calendar_range.map(
            (range) => ({
              start_date_field_id: range.fk_from_column_id ?? undefined,
              end_date_field_id: range.fk_to_column_id ?? undefined,
            }),
          );
          formattedData.calendar_range = undefined;
        }
        if (formattedData.kanban_stack_by_field_id) {
          formattedData.stack_by = {
            field_id: formattedData.kanban_stack_by_field_id,
            stack_order: (
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
        return formattedData;
      },
    });

    this.v3Tov2ViewBuilders.view = builderGenerator<any, any>({
      allowed: [
        'id',
        'type',
        'title',
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
      mappings: {},
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
        'date_ranges',
        'row_height',

        // kanban
        'stack_by',

        // gallery
        'cover_field_id',

        // form specific for now
        'fields_by_id',
        // form
        'form_title',
        'form_description',
        'submit_button_label',
        'thank_you_message',
        'redirect_url',
        'show_submit_another_button',
        'reset_form_after_submit',
        'banner',
        'logo',
      ],
      mappings: {
        // calendar
        date_ranges: 'calendar_range',

        // gallery
        cover_field_id: 'fk_cover_image_col_id',

        // form
        form_title: 'heading',
        form_description: 'subheading',
        thank_you_message: 'success_msg',
        show_submit_another_button: 'submit_another_form',
        reset_form_after_submit: 'show_blank_form',
        banner: 'banner_image_url',
        logo: 'logo_url',
      },
      transformFn: (options) => {
        const result = {
          ...options,
          // calendar
          ...(options.calendar_range?.length ?? 0 > 0
            ? {
                calendar_range: options.calendar_range.map((range) => ({
                  fk_from_column_id: range.start_date_field_id,
                  fk_to_column_id: range.end_date_field_id,
                })),
              }
            : {}),
          // kanban
          ...(options.stack_by?.field_id
            ? { fk_grp_col_id: options.stack_by.field_id }
            : {}),
        };

        return result;
      },
    }) as any;

    this.v3Tov2ViewBuilders.formFieldByIds = builderGenerator<any, any>({
      allowed: [
        'alias',
        'description',
        'required',
        'allow_scanner_input',
        'is_list',
        'is_limit_option',
        'validators',
      ],
      mappings: {
        alias: 'label',
        allow_scanner_input: 'enable_scanner',
      },
      transformFn: (field) => {
        if (!ncIsNullOrUndefined(field.is_list)) {
          field.meta = field.meta ?? {};
          field.meta.is_list = field.is_list;
          field.is_list = undefined;
        }
        if (!ncIsNullOrUndefined(field.is_limit_option)) {
          field.meta = field.meta ?? {};
          field.meta.is_limit_option = field.is_limit_option;
          field.is_limit_option = undefined;
        }
        if (!ncIsNullOrUndefined(field.validators)) {
          field.meta = field.meta ?? {};
          field.meta.validators = field.validators;
          field.validators = undefined;
        }
        return field;
      },
    }) as any;

    this.v3Tov2ViewBuilders.rowColors = builderGenerator<RowColoringInfo, any>({
      allowed: [
        'mode',
        'selectColumn',
        // 'options',
        'is_set_as_background',
        'conditions',
      ],
      mappings: {
        is_set_as_background: 'apply_as_row_background',
      },
      transformFn: (info) => {
        const { ...formattedInfo } = info;
        formattedInfo.mode = formattedInfo.mode.toLowerCase();
        if (formattedInfo.selectColumn) {
          formattedInfo.field_id = formattedInfo.selectColumn.id;
          delete formattedInfo.selectColumn;
        } else {
          formattedInfo.conditions = formattedInfo.conditions.map((cond) => {
            return {
              id: cond.id,
              apply_as_row_background: cond.is_set_as_background,
              color: cond.color,
              filters: addDummyRootAndNest(cond.conditions),
            };
          });
        }

        return formattedInfo;
      },
    }) as any;

    this.v2Tov3ViewBuilders.formFieldByIds = builderGenerator<any, any>({
      allowed: ['label', 'description', 'required', 'enable_scanner', 'meta'],
      mappings: {
        label: 'alias',
        enable_scanner: 'allow_scanner_input',
      },
      transformFn: (field) => {
        if (!ncIsNullOrUndefined(field.meta)) {
          field.is_list = field.meta.is_list;
          field.is_limit_option = field.meta.is_limit_option;
          field.validators = field.meta.validators
            ? field.meta.validators.map((val) => {
                return {
                  ...val,
                  regex: val.regex ? val.regex : undefined,
                };
              })
            : undefined;
          delete field.meta;
        }
        field = JSON.parse(JSON.stringify(field));
        return Object.keys(field).length > 0 ? field : undefined;
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

      const rowColor = await this.viewRowColorService.getByViewId({
        context,
        fk_view_id: view.id,
      });
      if (rowColor) {
        formattedView.row_coloring = this.v3Tov2ViewBuilders
          .rowColors()
          .build(rowColor);
      }
    }

    const viewColumnList = await View.getColumns(context, view.id);

    formattedView.fields = viewColumnBuilder().build(viewColumnList);
    formattedView.is_default = !formattedView.is_default
      ? undefined
      : formattedView.is_default;

    // extract the view specific infos
    switch (view.type) {
      case ViewTypes.GRID:
        {
          formattedView.options = formattedView.options ?? {};
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
              direction: (c as GridViewColumn).group_by_sort,
            }));
          if (group && group.length > 0) {
            formattedView.options.groups = group;
          }
          formattedView.options.row_height =
            RowHeightMap[formattedView.options.row_height ?? RowHeight.SHORT];
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
          formattedView.options = formattedView.options ?? {};
          formattedView.options.field_by_ids = viewColumnList.reduce(
            (acc, cur) => {
              acc[cur.fk_column_id] = this.v2Tov3ViewBuilders
                .formFieldByIds()
                .build(cur);
              return acc;
            },
            {},
          );
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
        'ViewOptions' +
        body.type[0].toUpperCase() +
        body.type.substring(1).toLowerCase();
      validatePayload(
        `swagger-v3.json#/components/schemas/${optionsSchemaName}`,
        body.options,
        true,
        context,
      );
      validatePayload(
        `swagger-v3.json#/components/schemas/ViewOptionBase`,
        body.options,
        true,
        context,
      );
    }

    if (!body.title) {
      NcError.get(context).invalidRequestBody(
        'Missing view `title` property in request body',
      );
    }
    const existingViewTitle = await View.getByTitleOrId(
      context,
      { fk_model_id: tableId, titleOrId: body.title },
      ncMeta,
    );
    if (existingViewTitle) {
      NcError.get(context).invalidRequestBody(
        `View title '${body.title}' already exists`,
      );
    }

    const viewTypeCode =
      viewTypeMap[(body.type as any as string).toLowerCase()];

    const { modelColumns } = await this.validateFieldIds(
      context,
      {
        req,
        tableId,
        fieldIds: this.extractFieldIdsFromRequest({
          req,
          body,
          tableId,
          isCreate: true,
          viewTypeCode,
        }),
      },
      ncMeta,
    );

    let requestBody = withoutId(this.v3Tov2ViewBuilders.view().build(body));
    requestBody.type = viewTypeCode;
    requestBody.options = requestBody.options ?? {};
    requestBody = {
      ...requestBody,
      ...this.v3Tov2ViewBuilders.options().build(requestBody.options),
    };

    const updateViewColumns = await this.getUpdateViewColumnCreate(
      context,
      {
        req,
        tableId,
        modelColumns,
        orderedFields: body.ordered_fields,
        fieldsById: body.options?.fields_by_id,
      },
      ncMeta,
    );
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
          if (!ncIsNullOrUndefined(requestBody.row_height)) {
            requestBody.row_height = RowHeightMap[requestBody.row_height];
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
                    (col) => col.fk_column_id === group.field_id,
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
              optionsOrder: requestBody.options.stack_by.stack_order ?? [],
              req,
            },
            trxNcMeta,
          );

          requestBody.options.stack_by = undefined;

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

      if (updateViewColumns && Object.keys(updateViewColumns).length > 0) {
        await this.saveUpdatedViewColumns(
          context,
          {
            updateViewColumns,
            req: param.req,
            viewId: insertedV2View.id,
            viewType: requestBody.type,
          },
          trxNcMeta,
        );
      }
      if (
        ![ViewTypes.FORM].includes(requestBody.type) &&
        requestBody.sorts?.length > 0
      ) {
        for (const sort of requestBody.sorts) {
          await this.sortsV3Service.sortCreate(
            context,
            {
              viewId: insertedV2View.id,
              req,
              sort: withoutId(sort),
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

  extractFieldIdsFromRequest(param: {
    req: NcRequest;
    body: any;
    tableId: string;
    isCreate?: boolean;
    viewTypeCode: ViewTypes;
  }) {
    const { body, viewTypeCode, isCreate } = param;
    const fieldIdToVerify = [];

    fieldIdToVerify.push(...Object.keys(body.options?.fields_by_id ?? {}));
    if (![ViewTypes.FORM].includes(viewTypeCode) && body.sorts) {
      fieldIdToVerify.push(...body.sorts.map((sort) => sort.field_id));
    }
    if (isCreate && body.orderedFields) {
      fieldIdToVerify.push(
        ...body.orderedFields.map((field) => field.field_id),
      );
    }
    if (!isCreate && body.fields) {
      fieldIdToVerify.push(...body.fields.map((field) => field.field_id));
    }
    if ([ViewTypes.GRID].includes(viewTypeCode) && body.options?.groups) {
      fieldIdToVerify.push(
        ...body.options.groups.map((field) => field.field_id),
      );
    }
    if (
      [ViewTypes.KANBAN].includes(viewTypeCode) &&
      body.options?.stack_by?.field_id
    ) {
      fieldIdToVerify.push(body.options?.stack_by?.field_id);
    }
    if (
      [ViewTypes.CALENDAR].includes(viewTypeCode) &&
      body.options?.date_ranges
    ) {
      fieldIdToVerify.push(
        ...(body.options?.date_ranges?.reduce((acc, cur) => {
          return [...acc, cur.start_date_field_id, cur.end_date_field_id];
        }, []) ?? []),
      );
    }

    if (body.options?.cover_field_id) {
      fieldIdToVerify.push(body.options?.cover_field_id);
    }
    // remove undefined
    return fieldIdToVerify.filter((k) => k);
  }

  async validateFieldIds(
    context: NcContext,
    param: {
      req: NcRequest;
      tableId: string;
      fieldIds: string[];
      modelColumns?: Column[];
    },
    ncMeta?: MetaService,
  ) {
    if ((param.fieldIds?.length ?? 0) === 0) {
      return { modelColumns: undefined };
    }
    const columns =
      param.modelColumns ??
      (await (
        await Model.get(context, param.tableId, ncMeta)
      ).getColumns(context, ncMeta));
    const existingColumnKeys = columns.map((k) => k.id);
    const invalidField = param.fieldIds.find(
      (col) => !existingColumnKeys.includes(col),
    );

    if (invalidField) {
      NcError.get(context).fieldNotFound(invalidField);
    }
    return { modelColumns: columns };
  }

  async getUpdateViewColumnCreate(
    context: NcContext,
    param: {
      req: NcRequest;
      tableId: string;
      modelColumns?: { id: string; order: number }[];
      orderedFields?: ViewCreateV3Type['ordered_fields'];
      fieldsById?: ViewOptionBaseV3Type['fields_by_id'];
    },
    ncMeta?: MetaService,
  ) {
    const result: Record<
      string,
      {
        width?: number;
        show?: boolean;
        order?: number;
      } & Record<string, any>
    > = {};
    if (
      (param.orderedFields ?? []).length === 0 &&
      Object.keys(param.fieldsById ?? {}).length === 0
    ) {
      return {};
    }
    const modelColumns =
      param.modelColumns ??
      (await (
        await Model.get(context, param.tableId, ncMeta)
      ).getColumns(context, ncMeta));
    if ((param.orderedFields ?? []).length > 0) {
      // we get the order by array index
      const orderedFieldMap = (param.orderedFields ?? []).reduce(
        (acc, val, idx) => {
          acc[val.field_id] = { ...val, order: idx };
          return acc;
        },
        {},
      );
      // get the next orders by array index + length
      // for the rest of the columns not mentioned in ordered field map
      const unorderedFieldMap = modelColumns
        .sort((a, b) => a.order - b.order)
        .map((k) => k.id)
        .filter((id) => !orderedFieldMap[id])
        .reduce((cur, id, idx) => {
          cur[id] = {
            order: idx + (param.orderedFields ?? []).length,
          };
          return cur;
        }, {});
      Object.assign(orderedFieldMap, unorderedFieldMap);
      for (const modelColumn of modelColumns) {
        if (modelColumn.order !== orderedFieldMap[modelColumn.id].order) {
          result[modelColumn.id] = {
            ...orderedFieldMap[modelColumn.id],
            ...(orderedFieldMap[modelColumn.id].width
              ? { width: orderedFieldMap[modelColumn.id].width + 'px' }
              : {}),
          };
        }
      }
    }
    for (const [colId, col] of Object.entries(param.fieldsById ?? {})) {
      result[colId] = {
        ...result[colId],
        ...this.v3Tov2ViewBuilders.formFieldByIds().build(col),
      };
    }
    return result;
  }

  async saveUpdatedViewColumns(
    context: NcContext,
    param: {
      req: NcRequest;
      viewId: string;
      viewType: ViewTypes;
      updateViewColumns: Record<string, any>;
    },
    ncMeta?: MetaService,
  ) {
    switch (param.viewType) {
      case ViewTypes.GRID: {
        const gridColumns = await this.gridColumnsService.columnList(
          context,
          { gridViewId: param.viewId },
          ncMeta,
        );
        for (const [columnId, col] of Object.entries(param.updateViewColumns)) {
          const viewColumn = gridColumns.find(
            (c) => c.fk_column_id === columnId,
          );
          await this.gridColumnsService.gridColumnUpdate(
            context,
            { gridViewColumnId: viewColumn.id, grid: col, req: param.req },
            ncMeta,
          );
        }
        break;
      }
      case ViewTypes.FORM: {
        const viewColumns = await this.viewColumnsService.columnList(
          context,
          { viewId: param.viewId },
          ncMeta,
        );
        for (const [columnId, col] of Object.entries(param.updateViewColumns)) {
          const viewColumn = viewColumns.find(
            (c) => c.fk_column_id === columnId,
          );
          await this.formColumnsService.columnUpdate(
            context,
            {
              formViewColumnId: viewColumn.id,
              formViewColumn: col,
              req: param.req,
            },
            ncMeta,
          );
        }

        break;
      }
      case ViewTypes.KANBAN:
      case ViewTypes.CALENDAR:
      case ViewTypes.GALLERY:
      default: {
        const viewColumns = await this.viewColumnsService.columnList(
          context,
          { viewId: param.viewId },
          ncMeta,
        );
        for (const [columnId, col] of Object.entries(param.updateViewColumns)) {
          const viewColumn = viewColumns.find(
            (c) => c.fk_column_id === columnId,
          );
          await this.viewColumnsService.columnUpdate(
            context,
            {
              columnId: viewColumn.id,
              column: col,
              viewId: param.viewId,
              req: param.req,
            },
            ncMeta,
          );
        }
      }
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
        'ViewOptions' +
        viewTypeStr[0].toUpperCase() +
        viewTypeStr.substring(1).toLowerCase();
      validatePayload(
        `swagger-v3.json#/components/schemas/${optionsSchemaName}`,
        body.options,
        true,
        context,
      );
      validatePayload(
        `swagger-v3.json#/components/schemas/ViewOptionBase`,
        body.options,
        true,
        context,
      );
    }
    if ('title' in body && !body.title) {
      NcError.get(context).invalidRequestBody(
        'Missing view `title` property in request body',
      );
    } else if ('title' in body && body.title !== existingView.title) {
      const existingViewTitle = await View.getByTitleOrId(
        context,
        { fk_model_id: existingView.fk_model_id, titleOrId: body.title },
        ncMeta,
      );
      if (existingViewTitle) {
        NcError.get(context).invalidRequestBody(
          `View title '${body.title}' already exists`,
        );
      }
    }

    const viewTypeCode = existingView.type;
    await this.validateFieldIds(
      context,
      {
        req,
        tableId: existingView.fk_model_id,
        fieldIds: this.extractFieldIdsFromRequest({
          req,
          body,
          tableId: existingView.fk_model_id,
          isCreate: true,
          viewTypeCode,
        }),
      },
      ncMeta,
    );

    let requestBody = this.v3Tov2ViewBuilders.view().build(body);

    requestBody.options = requestBody.options ?? {};
    requestBody = {
      ...requestBody,
      ...this.v3Tov2ViewBuilders.options().build(requestBody.options),
    };
    const updateViewColumns: Record<string, any> = {};
    // fields_by_id for update
    for (const [colId, col] of Object.entries(
      body.options?.fields_by_id ?? {},
    )) {
      updateViewColumns[colId] = {
        ...updateViewColumns[colId],
        ...this.v3Tov2ViewBuilders.formFieldByIds().build(col),
      };
    }

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
                      (col) => col.fk_column_id === group.field_id,
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

      if (updateViewColumns && Object.keys(updateViewColumns).length > 0) {
        await this.saveUpdatedViewColumns(
          context,
          {
            updateViewColumns,
            req: param.req,
            viewId: existingView.id,
            viewType: existingView.type,
          },
          trxNcMeta,
        );
      }

      // if sort is empty array, we clear sort
      if (
        ![ViewTypes.FORM].includes(existingView.type) &&
        Array.isArray(requestBody.sorts)
      ) {
        await Sort.deleteAll(context, viewId, trxNcMeta);
        for (const sort of requestBody.sorts) {
          await this.sortsV3Service.sortCreate(
            context,
            {
              viewId,
              req,
              sort: withoutId(sort),
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

  async delete(context: NcContext, param: { req: NcRequest; viewId: string }) {
    const { req, viewId } = param;
    await this.viewsService.viewDelete(context, {
      viewId,
      user: context.user,
      req,
    });
  }
}
