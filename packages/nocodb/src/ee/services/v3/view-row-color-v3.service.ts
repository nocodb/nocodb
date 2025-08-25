import { Injectable } from '@nestjs/common';
import {
  type NcContext,
  type NcRequest,
  PlanFeatureTypes,
  type ViewRowColourV3Type,
} from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import { checkForFeature } from '~/ee/helpers/paymentHelpers';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/ncError';
import Noco from '~/Noco';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';
import { ViewRowColorService } from '~/services/view-row-color.service';

@Injectable()
export class ViewRowColorV3Service {
  constructor(
    protected readonly viewRowColorService: ViewRowColorService,
    protected readonly filtersV3Service: FiltersV3Service,
  ) {}
  async replace(
    context: NcContext,
    params: {
      viewId: string;
      body?: ViewRowColourV3Type | null;
      req: NcRequest;
    },
    ncMeta?: MetaService,
  ) {
    const { viewId, body } = params;

    await checkForFeature(PlanFeatureTypes.FEATURE_ROW_COLOUR, context, ncMeta);

    await this.viewRowColorService.removeRowColorInfo({
      context,
      fk_view_id: viewId,
      ncMeta,
    });
    if (!body) {
      return;
    }
    validatePayload(
      'swagger-v3.json#/components/schemas/ViewRowColorCreate',
      body,
      true,
      context,
    );

    if (body?.mode === 'select') {
      if (!body.field_id) {
        NcError.get(context).requiredFieldMissing('field_id');
      }
      await this.viewRowColorService.setRowColoringSelect({
        context,
        fk_column_id: body.field_id,
        is_set_as_background: body.apply_as_row_background,
        fk_view_id: viewId,
        ncMeta,
      });
    } else if (body?.mode === 'filter') {
      await this.insertRowColorConditions(
        context,
        {
          ...params,
          body: params.body!,
        },
        ncMeta,
      );
    }
  }

  async insertRowColorConditions(
    context: NcContext,
    params: {
      viewId: string;
      body: ViewRowColourV3Type | null;
      req: NcRequest;
    },
    ncMeta: MetaService = Noco.ncMeta,
  ) {
    let i = 1;
    if ('conditions' in params.body) {
      for (const condition of params.body.conditions) {
        if (!condition.color) {
          NcError.get(context).requiredFieldMissing('color');
        }
        const rowColorCondition =
          await this.viewRowColorService.addRowColoringCondition({
            context,
            color: condition.color,
            is_set_as_background: condition.apply_as_row_background ?? false,
            nc_order: i++,
            fk_view_id: params.viewId,
            ncMeta,
          });
        await this.filtersV3Service.insertFilterGroup({
          context,
          param: { rowColorConditionId: rowColorCondition.id },
          groupOrFilter: condition.filters,
          viewId: params.viewId,
          ncMeta,
          isRoot: true,
        });
      }
    }
  }
}
