import { Injectable, Logger } from '@nestjs/common';
import {
  isCreatedOrLastModifiedByCol,
  isLinksOrLTAR,
  isOrderCol,
  isSystemColumn,
  NcBaseError,
  ncIsNullOrUndefined,
  parseProp,
  PlanFeatureTypes,
  RelationTypes,
  RowHeight,
  RowHeightMap,
  UITypes,
  viewTypeAlias,
  ViewTypes,
} from 'nocodb-sdk';
import { ViewsV3Service as ViewsV3ServiceCE } from 'src/services/v3/views-v3.service';
import type { RowColoringInfo, ViewCreateV3Type } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { ApiV3DataTransformationBuilder } from '~/utils/data-transformation.builder';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  CalendarViewColumn,
  Column,
  FormViewColumn,
  GalleryViewColumn,
  GridViewColumn,
  KanbanViewColumn,
  LinksColumn,
  MapViewColumn,
} from '~/models';
import { handleFieldsRequestBody } from '~/services/v3/view-v3/fields.helper';
import { ViewRowColorV3Service } from '~/services/v3/view-row-color-v3.service';
import { GridsService } from '~/services/grids.service';
import { CalendarsService } from '~/services/calendars.service';
import { KanbansService } from '~/services/kanbans.service';
import { GalleriesService } from '~/services/galleries.service';
import { FormsService } from '~/services/forms.service';
import { TimelinesService } from '~/services/timelines.service';
import { GanttsService } from '~/services/gantts.service';
import { GridColumnsService } from '~/services/grid-columns.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import Noco from '~/Noco';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { Model, Sort, View } from '~/models';
import DateDependency from '~/models/DateDependency';
import {
  builderGenerator,
  filterBuilder,
  viewColumnBuilder,
} from '~/utils/api-v3-data-transformation.builder';
import { ViewsService } from '~/services/views.service';
import { NcError } from '~/helpers/catchError';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';
import { addDummyRootAndNest } from '~/services/v3/filters-v3.helper';
import { SortsV3Service } from '~/services/v3/sorts-v3.service';
import { validatePayload } from '~/helpers';
import { FormColumnsService } from '~/services/form-columns.service';
import { ViewRowColorService } from '~/services/view-row-color.service';
import { withoutId } from '~/helpers/exportImportHelpers';
import { ViewWebhookManagerBuilder } from '~/utils/view-webhook-manager';

interface FormFieldByIdConfig {
  alias?: string;
  description?: string;
  required?: boolean;
  allow_scanner_input?: boolean;
  is_list?: boolean;
  is_limit_option?: boolean;
  validators?: {
    type: string;
    value?: string | number | null;
    message?: string;
    regex?: string;
  }[];
}

const viewTypeMap = {
  grid: ViewTypes.GRID,
  gallery: ViewTypes.GALLERY,
  kanban: ViewTypes.KANBAN,
  calendar: ViewTypes.CALENDAR,
  form: ViewTypes.FORM,
  timeline: ViewTypes.TIMELINE,
  gantt: ViewTypes.GANTT,
  ...viewTypeAlias,
};

const filterResponseFields = async (
  context: NcContext,
  param: {
    view: View;
    viewColumns: (
      | GridViewColumn
      | FormViewColumn
      | GalleryViewColumn
      | KanbanViewColumn
      | MapViewColumn
      | CalendarViewColumn
    )[];
  },
  ncMeta?: MetaService,
) => {
  const model = await Model.getByAliasOrId(
    context,
    {
      base_id: param.view.base_id,
      aliasOrId: param.view.fk_model_id,
    },
    ncMeta,
  );
  const modelColumns = await Promise.all(
    (
      await model.getColumns(context, ncMeta)
    ).map(async (col) => {
      if (col.uidt === UITypes.LinkToAnotherRecord) {
        await col.getColOptions(context, ncMeta);
      }
      return col;
    }),
  );
  const modelColumnMap: Record<string, Column> = modelColumns.reduce(
    (acc, cur) => {
      acc[cur.id] = cur;
      return acc;
    },
    {},
  );
  return param.viewColumns.filter((vCol) => {
    if (!modelColumnMap[vCol.fk_column_id]) {
      return false;
    }
    const col = modelColumnMap[vCol.fk_column_id];
    // remove _nc_mm_ field
    if (
      col.uidt === UITypes.LinkToAnotherRecord &&
      col.system &&
      (col.colOptions as LinksColumn).type === RelationTypes.HAS_MANY
    ) {
      return false;
    }
    if (isOrderCol(col) && col.system) {
      return false;
    }
    if (isCreatedOrLastModifiedByCol(col) && col.system) {
      return false;
    }
    if (!param.view.show_system_fields && isSystemColumn(col)) {
      return false;
    }
    return true;
  });
};

@Injectable()
export class ViewsV3Service extends ViewsV3ServiceCE {
  protected logger = new Logger(ViewsV3Service.name);
  private builder;
  private viewBuilder;
  private viewOptionsBuilder;
  private v3Tov2ViewBuilders: {
    view?: () => ApiV3DataTransformationBuilder<any, any>;
    options?: () => ApiV3DataTransformationBuilder<any, any>;
    formFieldByIds?: () => ApiV3DataTransformationBuilder<any, any>;
  } = {};
  private v2Tov3ViewBuilders: {
    formFieldByIds?: () => ApiV3DataTransformationBuilder<any, any>;
    rowColors?: () => ApiV3DataTransformationBuilder<RowColoringInfo, any>;
    viewMeta?: () => ApiV3DataTransformationBuilder<RowColoringInfo, any>;
  } = {};

  constructor(
    protected readonly viewsService: ViewsService,
    protected readonly viewColumnsService: ViewColumnsService,
    protected readonly viewRowColorV3Service: ViewRowColorV3Service,
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
    protected timelinesService: TimelinesService,
    protected ganttsService: GanttsService,
  ) {
    super();
    this.builder = builderGenerator({
      allowed: [
        'id',
        'title',
        'lock_type',
        'description',
        'fk_model_id',
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
        fk_model_id: 'table_id',
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
        if (!formattedData.description || formattedData.description === '') {
          formattedData.description = undefined;
        }

        if (Object.keys(formattedData.options ?? {}).length === 0) {
          formattedData.options = undefined;
        }

        if (formattedData.lock_type !== 'personal') {
          formattedData.owned_by = undefined;
        }
        return formattedData;
      },
    });

    this.viewBuilder = builderGenerator({
      allowed: [
        'id',
        'title',
        'fk_model_id',
        'view_type',
        'lock_type',
        'description',
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
        fk_model_id: 'table_id',
      },
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
          formattedData.options = this.v2Tov3ViewBuilders.viewMeta().build({
            ...optionMeta,
          });
        }
        if (Object.keys(options).length > 0) {
          formattedData.options = options;
        }
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
        'submit_button_label',
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

        // timeline
        'timeline_range',

        // gantt
        'date_dependency',
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
        submit_button_label: ['meta', 'submit_button_label'],
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
        if (formattedData?.timeline_range?.length) {
          formattedData.date_ranges = formattedData.timeline_range.map(
            (range: any) => ({
              start_date_field_id: range.fk_from_column_id ?? undefined,
              end_date_field_id: range.fk_to_column_id ?? undefined,
            }),
          );
          formattedData.timeline_range = undefined;
        }
        if (formattedData?.date_dependency) {
          const rule = formattedData.date_dependency;
          // Flatten DB columns into atomic child blocks. A block is emitted
          // only when at least one of its underlying columns has a value —
          // an empty block on the wire would be misleading.
          const dates =
            rule.fk_start_date_field_id || rule.fk_end_date_field_id
              ? {
                  start_field_id: rule.fk_start_date_field_id ?? undefined,
                  end_field_id: rule.fk_end_date_field_id ?? undefined,
                }
              : undefined;
          const dependency = rule.fk_dependency_linkrow_field_id
            ? {
                linkrow_field_id: rule.fk_dependency_linkrow_field_id,
                linkrow_role: rule.dependency_linkrow_role,
                connection_type: rule.dependency_connection_type,
                buffer_type: rule.dependency_buffer_type,
                buffer_days: rule.dependency_buffer_days ?? 0,
              }
            : undefined;
          formattedData.date_dependency = {
            dates,
            duration_field_id: rule.fk_duration_field_id ?? undefined,
            dependency,
            include_weekends: rule.include_weekends,
            is_active: rule.is_active,
          };
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
              .sort((a, b) => a.order - b.order)
              .map((k) => k.title),
          };
          formattedData.kanban_stack_by_field_id = undefined;
        }

        // convert redirect_after_secs from string to integer (V2 stores as varchar)
        if (formattedData.form_redirect_after_secs != null) {
          formattedData.form_redirect_after_secs = Number(
            formattedData.form_redirect_after_secs,
          );
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
        'lock_type',
        'title',
        'description',
        'filters',
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
        // calendar / timeline (both use date_ranges on the v3 wire)
        'date_ranges',
        'row_height',

        // kanban
        'stack_by',

        // gallery
        'cover_field_id',

        // gantt
        'date_dependency',

        // form specific for now
        'fields_by_id',
        // form
        'form_title',
        'form_description',
        'submit_button_label',
        'thank_you_message',
        'redirect_url',
        'form_redirect_after_secs',
        'send_response_email_to',
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
        form_redirect_after_secs: 'redirect_after_secs',
        send_response_email_to: 'email',
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

        // timeline — same `date_ranges` v3 key, but routes to timeline_range.
        // Service routing on ViewTypes.TIMELINE picks this up; the calendar
        // branch above only fires for calendar views since the service
        // consults the actual view type, not the property name.
        if (options.date_ranges?.length) {
          result.timeline_range = options.date_ranges.map((range: any) => ({
            fk_from_column_id: range.start_date_field_id,
            fk_to_column_id: range.end_date_field_id ?? null,
          }));
        }

        // gantt — flatten the nested API shape (atomic `dates` / `dependency`
        // child blocks) into the flat DateDependencyReqType the V2 service
        // expects. Empty/missing child blocks become null FKs.
        if (options.date_dependency) {
          const dd = options.date_dependency;
          result.dependency = {
            fk_start_date_field_id: dd.dates?.start_field_id ?? null,
            fk_end_date_field_id: dd.dates?.end_field_id ?? null,
            fk_duration_field_id: dd.duration_field_id ?? null,
            fk_dependency_linkrow_field_id:
              dd.dependency?.linkrow_field_id ?? null,
            dependency_linkrow_role: dd.dependency?.linkrow_role,
            dependency_connection_type: dd.dependency?.connection_type,
            dependency_buffer_type: dd.dependency?.buffer_type,
            dependency_buffer_days: dd.dependency?.buffer_days ?? 0,
            include_weekends: dd.include_weekends,
            is_active: dd.is_active,
          };
          // The gantt service reads `dependency`; the bare `date_dependency`
          // node is for the v3 transformer round-trip only.
          result.date_dependency = undefined;
        }

        // convert redirect_after_secs from integer to string (V2 expects StringOrNull)
        if (
          result.redirect_after_secs !== undefined &&
          result.redirect_after_secs !== null
        ) {
          result.redirect_after_secs = String(result.redirect_after_secs);
        }

        // pack submit_button_label into meta (stored in FormView.meta JSON)
        if (result.submit_button_label !== undefined) {
          result.meta = result.meta ?? {};
          result.meta.submit_button_label = result.submit_button_label;
          result.submit_button_label = undefined;
        }

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
        // field meta will be appended with existing column meta during
        // saveUpdatedViewColumns

        return field;
      },
    }) as any;

    this.v2Tov3ViewBuilders.rowColors = builderGenerator<RowColoringInfo, any>({
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
              filters: addDummyRootAndNest(
                cond.conditions.map((filter) => filterBuilder().build(filter)),
              ),
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

    this.v2Tov3ViewBuilders.viewMeta = builderGenerator<any, any>({
      mappings: {
        lockedViewDescription: 'locked_view_description',
        lockedByUserId: 'locked_by_user_id',
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

  async getView(
    context: NcContext,
    param: { viewId: string; req: NcRequest },
    ncMeta?: MetaService,
  ) {
    const view = await View.get(context, param.viewId, false, ncMeta);
    // todo: check for GUI permissions, since we are handling at ui level we can ignore for now

    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    await view.getViewWithInfo(context, ncMeta);

    const formattedView = this.viewBuilder().build(view);

    if (view.type !== ViewTypes.FORM) {
      // get filters
      const filters = await this.filtersV3Service.filterList(
        context,
        {
          viewId: view.id,
        },
        ncMeta,
      );

      formattedView.filters = filters;

      // get sorts
      const sorts = await this.sortsV3Service.sortList(
        context,
        {
          viewId: view.id,
        },
        ncMeta,
      );

      formattedView.sorts = sorts?.length ? sorts : undefined;

      const rowColor = await this.viewRowColorService.getByViewId(context, {
        fk_view_id: view.id,
        ncMeta,
      });
      if (rowColor) {
        formattedView.row_coloring = this.v2Tov3ViewBuilders
          .rowColors()
          .build(rowColor);
      }
    }

    let viewColumnList = await View.getColumns(context, view.id, ncMeta);
    viewColumnList = await filterResponseFields(
      context,
      { view, viewColumns: viewColumnList },
      ncMeta,
    );
    formattedView.fields = viewColumnBuilder().build(
      viewColumnList.sort((a, b) => a.order - b.order),
    );

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
          formattedView.options.fields_by_id = viewColumnList.reduce(
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
    // Validate per-view-type options. For gantt/timeline the create-time
    // variant requires date_dependency / date_ranges respectively, so we run
    // validation even when `body.options` is omitted entirely — AJV then
    // surfaces a clear "must have required property" error instead of letting
    // the request slip through and fail deeper in the pipeline.
    const typeLower = body.type?.toLowerCase?.();
    const requiresOptionsOnCreate = ['gantt', 'timeline'].includes(typeLower);
    if (body.options || requiresOptionsOnCreate) {
      const optionsSchemaName =
        'ViewOptions' +
        body.type[0].toUpperCase() +
        body.type.substring(1).toLowerCase() +
        (requiresOptionsOnCreate ? 'Create' : '');
      validatePayload(
        `swagger-v3.json#/components/schemas/${optionsSchemaName}`,
        body.options ?? {},
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

    if (viewTypeCode === ViewTypes.GANTT) {
      this.validateGanttFieldTypes(context, body, modelColumns);
    } else if (viewTypeCode === ViewTypes.TIMELINE) {
      this.validateTimelineFieldTypes(context, body, modelColumns);
    }

    let requestBody = withoutId(this.v3Tov2ViewBuilders.view().build(body));
    requestBody.type = viewTypeCode;
    requestBody.options = requestBody.options ?? {};
    requestBody = {
      ...requestBody,
      ...this.v3Tov2ViewBuilders.options().build(requestBody.options),
    };

    const updateViewColumns = await this.getUpdateViewColumn(
      context,
      {
        req,
        tableId,
        modelColumns,
        fields: body.fields,
        fieldsById: body.options?.fields_by_id,
      },
      ncMeta,
    );
    const viewWebhookManager = (
      await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(tableId)
    ).forCreate();

    const trxNcMeta = ncMeta ? ncMeta : await Noco.ncMeta.startTransaction();

    let insertedV2View: View;
    try {
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
              viewWebhookManager,
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
                  viewWebhookManager,
                },
                trxNcMeta,
              );
            }
          }
          break;
        }
        case ViewTypes.CALENDAR: {
          // Feature-gate multi-range calendar views
          if (requestBody.calendar_range?.length > 1) {
            await checkForFeature(
              context,
              PlanFeatureTypes.FEATURE_CALENDAR_RANGE,
            );
          }

          insertedV2View = await this.calendarsService.calendarViewCreate(
            context,
            {
              tableId,
              calendar: requestBody,
              req: req,
              user: context.user,
              viewWebhookManager,
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
              viewWebhookManager,
            },
            trxNcMeta,
          );
          if (requestBody.options?.stack_by) {
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
          }

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
              viewWebhookManager,
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
              viewWebhookManager,
            },
            trxNcMeta,
          );
          break;
        }
        case ViewTypes.TIMELINE: {
          // The shared options builder renames `date_ranges` → `calendar_range`
          // for every view type (calendar's mapping is unconditional). For
          // timeline we re-derive `timeline_range` from the original body so
          // the `label` is preserved (the calendar_range branch drops it),
          // then clear the spurious calendar_range. View.insertMetaOnly's
          // TIMELINE case reads view.timeline_range.
          if (body.options?.date_ranges?.length) {
            requestBody.timeline_range = body.options.date_ranges.map(
              (r: any) => ({
                fk_from_column_id: r.start_date_field_id,
                fk_to_column_id: r.end_date_field_id ?? null,
                label: r.label,
              }),
            );
          }
          requestBody.calendar_range = undefined;

          insertedV2View = await this.timelinesService.timelineViewCreate(
            context,
            {
              tableId,
              timeline: requestBody,
              user: context.user,
              req,
              viewWebhookManager,
            },
            trxNcMeta,
          );
          break;
        }
        case ViewTypes.GANTT: {
          // The gantt service accepts an optional per-view `dependency` rule
          // — the v3 transformer flattened `options.date_dependency` into
          // requestBody.dependency above. Omitting it lets the view fall
          // back to the table-level default rule.
          insertedV2View = await this.ganttsService.ganttViewCreate(
            context,
            {
              tableId,
              gantt: requestBody,
              dependency: requestBody.dependency,
              user: context.user,
              req,
              viewWebhookManager,
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
      if (body.row_coloring) {
        await this.viewRowColorV3Service.replace(
          context,
          {
            viewId: insertedV2View.id,
            body: body.row_coloring,
            req,
            viewWebhookManager,
          },
          trxNcMeta,
        );
      }
      if (requestBody.filters) {
        await this.filtersV3Service.insertFilterGroup({
          context,
          param: {
            viewId: insertedV2View.id,
          },
          groupOrFilter: requestBody.filters,
          viewId: insertedV2View.id,
          viewWebhookManager,
        });
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
              viewWebhookManager,
            },
            trxNcMeta,
          );
        }
      }

      if (!ncMeta) {
        await trxNcMeta.commit();
      }
    } catch (ex) {
      // Only roll back if we own the transaction — otherwise let the caller
      // decide what to do with their externally-passed trx.
      if (!ncMeta) await trxNcMeta.rollback();
      if (ex instanceof NcError || ex instanceof NcBaseError) throw ex;
      this.logger.error('Failed to create view', ex);
      NcError.get(param.req.context).internalServerError(
        'Failed to create view',
      );
    }

    // Post-commit: must not be inside the try/catch above — a throw here
    // would trigger rollback() on an already-committed transaction.
    const result = await this.getView(context, {
      viewId: insertedV2View.id,
      req,
    });
    viewWebhookManager.withNewView(result);
    viewWebhookManager.emit();
    return result;
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
      [ViewTypes.CALENDAR, ViewTypes.TIMELINE].includes(viewTypeCode) &&
      body.options?.date_ranges
    ) {
      fieldIdToVerify.push(
        ...(body.options?.date_ranges?.reduce((acc, cur) => {
          return [...acc, cur.start_date_field_id, cur.end_date_field_id];
        }, []) ?? []),
      );
    }
    if (
      [ViewTypes.GANTT].includes(viewTypeCode) &&
      body.options?.date_dependency
    ) {
      const dd = body.options.date_dependency;
      fieldIdToVerify.push(
        dd.dates?.start_field_id,
        dd.dates?.end_field_id,
        dd.duration_field_id,
        dd.dependency?.linkrow_field_id,
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
    let columns = param.modelColumns;
    if (!columns) {
      const model = await Model.get(context, param.tableId, false, ncMeta);
      if (!model) {
        NcError.get(context).tableNotFound(param.tableId);
      }
      columns = await model.getColumns(context, ncMeta);
    }
    const existingColumnKeys = columns.map((k) => k.id);
    const invalidField = param.fieldIds.find(
      (col) => !existingColumnKeys.includes(col),
    );

    if (invalidField) {
      NcError.get(context).fieldNotFound(invalidField);
    }
    return { modelColumns: columns };
  }

  // Gantt's start/end date fields, duration field, and dependency linkrow
  // field have strict UIType requirements that DateDependency.insert (called
  // via View.insertMetaOnly from the gantt create path) does NOT enforce —
  // only the standalone date-dependency service does. Validate here so v3
  // create/update reject mismatched types up front (e.g. DateTime is NOT a
  // valid gantt date field — only UITypes.Date is).
  validateGanttFieldTypes(
    context: NcContext,
    body: { options?: { date_dependency?: any } },
    modelColumns?: Column[],
  ) {
    const dd = body.options?.date_dependency;
    if (!dd) return;

    const colById = new Map((modelColumns ?? []).map((c) => [c.id, c]));

    const checkType = (
      fieldId: string | null | undefined,
      label: string,
      predicate: (col: Column) => boolean,
      expected: string,
    ) => {
      if (!fieldId) return;
      const col = colById.get(fieldId);
      if (!col || !predicate(col)) {
        NcError.get(context).invalidRequestBody(
          `${label} must be a ${expected} type field`,
        );
      }
    };

    checkType(
      dd.dates?.start_field_id,
      'Start date field',
      (c) => [UITypes.Date, UITypes.DateTime].includes(c.uidt as UITypes),
      'Date or DateTime',
    );
    checkType(
      dd.dates?.end_field_id,
      'End date field',
      (c) => [UITypes.Date, UITypes.DateTime].includes(c.uidt as UITypes),
      'Date or DateTime',
    );
    checkType(
      dd.duration_field_id,
      'Duration field',
      (c) => [UITypes.Duration, UITypes.Number].includes(c.uidt as UITypes),
      'Duration or Number',
    );
    checkType(
      dd.dependency?.linkrow_field_id,
      'Dependency linkrow field',
      (c) => isLinksOrLTAR(c),
      'Links or LinkToAnotherRecord',
    );
  }

  // Timeline range fields accept any date-shaped column: Date, DateTime,
  // CreatedTime, LastModifiedTime. Mirrors the frontend filter in
  // ee/components/smartsheet/toolbar/Timeline/Range.vue. The underlying
  // TimelineView.insert does not type-check field IDs, so we enforce here.
  validateTimelineFieldTypes(
    context: NcContext,
    body: { options?: { date_ranges?: Array<any> } },
    modelColumns?: Column[],
  ) {
    const ranges = body.options?.date_ranges;
    if (!ranges?.length) return;

    const colById = new Map((modelColumns ?? []).map((c) => [c.id, c]));
    const ALLOWED = [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ];

    const checkType = (fieldId: string | null | undefined, label: string) => {
      if (!fieldId) return;
      const col = colById.get(fieldId);
      if (!col || !ALLOWED.includes(col.uidt as UITypes)) {
        NcError.get(context).invalidRequestBody(
          `${label} must be a Date, DateTime, CreatedTime, or LastModifiedTime type field`,
        );
      }
    };

    for (const range of ranges) {
      checkType(range?.start_date_field_id, 'Start date field');
      checkType(range?.end_date_field_id, 'End date field');
    }
  }

  async getUpdateViewColumn(
    context: NcContext,
    param: {
      req: NcRequest;
      tableId: string;
      modelColumns?: { id: string; pv: boolean; order: number }[];
      fields?: ViewCreateV3Type['fields'];
      fieldsById?: Record<string, FormFieldByIdConfig>;
    },
    ncMeta?: MetaService,
  ) {
    const result = await handleFieldsRequestBody(context, param, ncMeta);
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
          if (col.meta) {
            col.meta = {
              ...((viewColumn as any).meta ?? {}),
              ...col.meta,
            };
          }
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
    ncMeta = Noco.ncMeta,
  ) {
    const { req, viewId } = param;
    const { body } = req;

    validatePayload(
      'swagger-v3.json#/components/schemas/ViewUpdate',
      body,
      true,
      context,
    );

    const existingView = await View.get(context, viewId, false, ncMeta);
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
    const { modelColumns } = await this.validateFieldIds(
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

    if (viewTypeCode === ViewTypes.GANTT) {
      this.validateGanttFieldTypes(context, body, modelColumns);
    } else if (viewTypeCode === ViewTypes.TIMELINE) {
      this.validateTimelineFieldTypes(context, body, modelColumns);
    }

    let requestBody = this.v3Tov2ViewBuilders.view().build(body);

    requestBody.options = requestBody.options ?? {};
    requestBody = {
      ...requestBody,
      ...this.v3Tov2ViewBuilders.options().build(requestBody.options),
    };

    const updateViewColumns = await this.getUpdateViewColumn(
      context,
      {
        req,
        tableId: existingView.fk_model_id,
        fields: body.fields,
        modelColumns,
        fieldsById: body.options?.fields_by_id,
      },
      ncMeta,
    );

    const viewWebhookManager = (
      await (
        await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
          existingView.fk_model_id,
        )
      ).withViewId(existingView.id)
    ).forUpdate();
    const trxNcMeta = await ncMeta.startTransaction();
    try {
      await this.viewsService.viewUpdate(context, {
        viewId,
        view: requestBody,
        req,
        viewWebhookManager,
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
          if (!ncIsNullOrUndefined(requestBody.row_height)) {
            requestBody.row_height = RowHeightMap[requestBody.row_height];
          }
          await this.gridsService.gridViewUpdate(
            context,
            {
              grid: requestBody,
              req: req,
              viewId,
              viewWebhookManager,
            },
            trxNcMeta,
          );
          if (groups && Array.isArray(groups)) {
            await this.gridColumnsService.gridColumnClearGroupBy(
              context,
              { viewId, viewWebhookManager },
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
                    viewWebhookManager,
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
          // Feature-gate multi-range calendar views
          if (requestBody.calendar_range?.length > 1) {
            await checkForFeature(
              context,
              PlanFeatureTypes.FEATURE_CALENDAR_RANGE,
            );
          }

          await this.calendarsService.calendarViewUpdate(
            context,
            {
              calendar: requestBody,
              req: req,
              calendarViewId: viewId,
              viewWebhookManager,
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
              viewWebhookManager,
            },
            trxNcMeta,
          );

          if (requestBody.options?.stack_by) {
            await this.kanbansService.kanbanOptionsReorder(
              context,
              {
                kanbanViewId: existingView.id,
                optionsOrder: requestBody.options.stack_by.stack_order ?? [],
                req,
                viewWebhookManager,
              },
              trxNcMeta,
            );
            requestBody.options.stack_by = undefined;
          }
          break;
        }
        case ViewTypes.GALLERY: {
          await this.galleriesService.galleryViewUpdate(
            context,
            {
              galleryViewId: viewId,
              gallery: requestBody,
              req: req,
              viewWebhookManager,
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
              viewWebhookManager,
            },
            trxNcMeta,
          );
          break;
        }
        case ViewTypes.TIMELINE: {
          // Same re-derivation as in create: the options builder's generic
          // calendar_range mapping consumes date_ranges; rebuild
          // timeline_range from the original body for the timeline service.
          // TimelineView.update reads view.timeline_range and replaces the
          // range rows wholesale (delete + bulkInsert).
          if (body.options?.date_ranges?.length) {
            requestBody.timeline_range = body.options.date_ranges.map(
              (r: any) => ({
                fk_from_column_id: r.start_date_field_id,
                fk_to_column_id: r.end_date_field_id ?? null,
              }),
            );
          }
          requestBody.calendar_range = undefined;

          await this.timelinesService.timelineViewUpdate(
            context,
            {
              timelineViewId: viewId,
              timeline: requestBody,
              req,
              viewWebhookManager,
            },
            trxNcMeta,
          );
          break;
        }
        case ViewTypes.GANTT: {
          await this.ganttsService.ganttViewUpdate(
            context,
            {
              ganttViewId: viewId,
              gantt: requestBody,
              req,
              viewWebhookManager,
            },
            trxNcMeta,
          );
          // When `options.date_dependency` is included in the PATCH, replace
          // the view-owned DateDependency rule wholesale (per the spec —
          // PATCH is replace-not-merge for this field). Omitting the field
          // leaves the existing rule untouched; passing it as `null` clears
          // the view-owned rule.
          if ('date_dependency' in (req.body?.options ?? {})) {
            const flat = requestBody.dependency;
            const existing = await DateDependency.getByGanttViewId(
              context,
              viewId,
              trxNcMeta,
            );
            if (existing?.id) {
              await DateDependency.delete(context, existing.id, trxNcMeta);
            }
            if (req.body.options.date_dependency !== null && flat) {
              await DateDependency.insert(
                context,
                {
                  ...flat,
                  fk_gantt_view_id: viewId,
                  fk_model_id: existingView.fk_model_id,
                },
                trxNcMeta,
              );
            }
          }
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

      if ('filters' in requestBody) {
        // skip viewWebhookManager for this, deleteAll is not a standalone operation, it's invoked by view service
        await this.filtersV3Service.filterDeleteAll(
          context,
          { viewId: existingView.id },
          trxNcMeta,
        );
        await this.filtersV3Service.insertFilterGroup({
          context,
          param: {
            viewId: existingView.id,
          },
          groupOrFilter: requestBody.filters,
          viewId: existingView.id,
          viewWebhookManager,
          ncMeta: trxNcMeta,
        });
      }
      if ('row_coloring' in body) {
        await this.viewRowColorV3Service.replace(
          context,
          {
            viewId: existingView.id,
            body: body.row_coloring,
            req,
            viewWebhookManager,
          },
          trxNcMeta,
        );
      }
      // if sort is empty array, we clear sort
      if (
        ![ViewTypes.FORM].includes(existingView.type) &&
        Array.isArray(requestBody.sorts)
      ) {
        // skip viewWebhookManager for this, Sort.deleteAll is not a standalone operation, it's invoked by view service
        await Sort.deleteAll(context, viewId, trxNcMeta);
        for (const sort of requestBody.sorts) {
          await this.sortsV3Service.sortCreate(
            context,
            {
              viewId,
              req,
              sort: withoutId(sort),
              viewWebhookManager,
            },
            trxNcMeta,
          );
        }
      }

      await trxNcMeta.commit();
    } catch (ex) {
      await trxNcMeta.rollback();
      if (ex instanceof NcError || ex instanceof NcBaseError) throw ex;
      this.logger.error('Failed to update view', ex);
      NcError.get(param.req.context).internalServerError(
        'Failed to update view',
      );
    }

    // Post-commit: must not be inside the try/catch above — a throw here
    // would trigger rollback() on an already-committed transaction.
    const result = await this.getView(context, { viewId, req });
    viewWebhookManager.withNewView(result).emit();
    return result;
  }

  async delete(context: NcContext, param: { req: NcRequest; viewId: string }) {
    const { req, viewId } = param;
    await this.viewsService.viewDelete(context, {
      viewId,
      req,
    });
  }
}
