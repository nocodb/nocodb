import { Injectable } from '@nestjs/common';
import type {
  ColumnReqType,
  FilterType,
  NcContext,
  NcRequest,
  RowColoringInfo,
} from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { Column } from '~/models';

export interface RowColorConditionBody {
  color: string;
  is_set_as_background: boolean;
  nc_order: number;
  type?: string;
  fk_target_column_id?: string;
}

@Injectable()
export class ViewRowColorService {
  async getByViewId(
    _context: NcContext,
    _param: {
      fk_view_id?: string;
      ncMeta?: MetaService;
    },
  ): Promise<RowColoringInfo | null> {
    return null;
  }

  async addRowColoringCondition(
    _context: NcContext,
    _param: {
      fk_view_id?: string;
      condition: RowColorConditionBody & { id?: string };
      req?: NcRequest;
      filter?: FilterType;
      filters?: FilterType[];
      ncMeta?: MetaService;
    },
  ): Promise<{
    id: string;
    info: RowColoringInfo;
  }> {
    return null;
  }

  async updateRowColoringCondition(
    _context: NcContext,
    _param: {
      fk_view_id?: string;
      fk_row_coloring_conditions_id: string;
      condition: RowColorConditionBody;
      req?: NcRequest;
      ncMeta?: MetaService;
    },
  ) {}

  async deleteRowColoringCondition(
    _context: NcContext,
    _param: {
      fk_view_id?: string;
      fk_row_coloring_conditions_id: string;
      req?: NcRequest;
      ncMeta?: MetaService;
    },
  ) {}

  async setRowColoringSelect(
    _context: NcContext,
    _param: {
      fk_view_id?: string;
      fk_column_id: string;
      is_set_as_background: boolean;
      req?: NcRequest;
      ncMeta?: MetaService;
    },
  ) {}

  async removeRowColorInfo(
    _context: NcContext,
    _param: {
      fk_view_id?: string;
      req?: NcRequest;
      ncMeta?: MetaService;
    },
  ) {}

  async checkIfColumnInvolved(
    _context: NcContext,
    _param: {
      existingColumn: Column;
      newColumn?: Column | ColumnReqType;
      action: 'delete' | 'update';
      ncMeta?: MetaService;
    },
  ) {
    return {
      applyRowColorInvolvement: async () => {},
    };
  }

  async restoreRowColoring(
    _context: NcContext,
    _param: {
      fk_view_id: string;
      snapshot: {
        row_coloring_mode: string | null;
        meta?: unknown;
        conditions?: unknown;
      };
      req?: NcRequest;
      ncMeta?: MetaService;
    },
  ) {}
}
