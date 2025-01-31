import { Injectable, Logger } from '@nestjs/common';
import { viewTypeAlias, ViewTypes } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { GridViewColumn } from '~/models';
import { View } from '~/models';
import {
  builderGenerator,
  viewColumnBuilder,
} from '~/utils/api-v3-data-transformation.builder';
import { ViewsService } from '~/services/views.service';
import { NcError } from '~/helpers/catchError';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';
import { SortsV3Service } from '~/services/v3/sorts-v3.service';

@Injectable()
export class ViewsV3Service {
  protected logger = new Logger(ViewsV3Service.name);
  private builder;
  private viewBuilder;

  constructor(
    protected readonly viewsService: ViewsService,
    protected filtersV3Service: FiltersV3Service,
    protected sortsV3Service: SortsV3Service,
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
        heading: 'form_heading',
        subheading: 'form_sub_heading',
        success_msg: 'form_success_message',
        redirect_url: 'form_redirect_url',
        redirect_after_secs: 'form_redirect_after_secs',
        email: 'form_send_response_email',
        submit_another_form: 'form_show_another',
        show_blank_form: 'form_show_blank',
        hide_banner: 'form_hide_banner',
        hide_branding: 'form_hide_branding',
        banner_image_url: 'form_banner_image_url',
        logo_url: 'form_logo_url',
        background_color: 'form_background_color',

        date_range: 'calendar_range',

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
        const { view, ...formattedData } = viewData;
        formattedData.view_type = viewTypeAlias[formattedData.view_type];

        if (view?.calendar_range?.length) {
          formattedData.calendar_range = view.calendar_range.map((range) => ({
            start_field_id: range.fk_from_column_id ?? undefined,
            end_field_id: range.fk_to_column_id ?? undefined,
          }));
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

    const formattedView = this.viewBuilder().build({
      ...view.view,
      ...view,
    });

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

    return formattedView;
  }
}
