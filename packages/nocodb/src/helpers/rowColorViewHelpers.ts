import { type NcContext } from 'nocodb-sdk';
import type RowColorCondition from '~/models/RowColorCondition';
import type { MetaService } from '~/meta/meta.service';
import type { Filter, View } from '~/models';
import Noco from '~/Noco';

export type GetRowColorConditionsResult = {
  view: View;
  rowColoringConditions: {
    record: RowColorCondition;
    filters: Filter[];
  }[];
}[];

export class RowColorViewHelpers {
  protected constructor(
    protected readonly context: NcContext,
    protected props: {
      ncMeta: MetaService;
    },
  ) {}
  static withContext(
    context: NcContext,
    props?: {
      ncMeta?: MetaService;
    },
  ) {
    if (!props) {
      props = {};
    }
    if (!props.ncMeta) {
      props.ncMeta = Noco.ncMeta;
    }
    return new RowColorViewHelpers(context, props as any);
  }

  async getRowColorConditions(
    views: View[],
  ): Promise<GetRowColorConditionsResult> {
    return views.map((v) => ({
      view: v,
      rowColoringConditions: [],
    }));
  }

  async randomizeRowColorConditionId(payload: GetRowColorConditionsResult) {
    return payload;
  }

  async getDuplicateRowColorConditions(param: {
    views: View[];
    idMap: Map<string, string>;
    mapColumnId?: boolean;
  }): Promise<{
    result: GetRowColorConditionsResult;
    filters: Filter[];
    rowColorConditions: RowColorCondition[];
  }> {
    return {
      result: param.views.map((v) => ({
        view: v,
        rowColoringConditions: [],
      })),
      filters: [],
      rowColorConditions: [],
    };
  }

  mapMetaColumn(payload: { meta?: any; idMap: Map<string, string> }) {
    return payload.meta;
  }

  async viewDeleted(_view: View) {}
}
