import { Injectable } from '@nestjs/common';
import type { FilterType, NcContext, RowColoringInfo } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';

@Injectable()
export class ViewRowColorService {
  async getByViewId(_params: {
    context: NcContext;
    fk_view_id?: string;
    ncMeta?: MetaService;
  }): Promise<RowColoringInfo | null> {
    return null;
  }

  async addRowColoringCondition(_params: {
    context: NcContext;
    fk_view_id?: string;
    color: string;
    is_set_as_background: boolean;
    nc_order: number;
    filter: FilterType;
    ncMeta?: MetaService;
  }): Promise<RowColoringInfo | null> {
    return null;
  }

  async updateRowColoringCondition(_params: {
    context: NcContext;
    fk_view_id?: string;
    fk_row_coloring_conditions_id: string;
    color: string;
    is_set_as_background: boolean;
    nc_order: number;
    ncMeta?: MetaService;
  }) {}

  async deleteRowColoringCondition(_params: {
    context: NcContext;
    fk_view_id?: string;
    fk_row_coloring_conditions_id: string;
    ncMeta?: MetaService;
  }) {}

  async setRowColoringSelect(_params: {
    context: NcContext;
    fk_view_id?: string;
    color: string;
    fk_column_id: string;
    is_set_as_background: boolean;
    ncMeta?: MetaService;
  }) {}

  async removeRowColorInfo(_params: {
    context: NcContext;
    fk_view_id?: string;
    ncMeta?: MetaService;
  }) {}
}
