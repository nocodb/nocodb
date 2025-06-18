import { type NcContext, parseProp } from 'nocodb-sdk';
import type RowColorCondition from '~/models/RowColorCondition';
import type { MetaService } from '~/meta/meta.service';
import type { Filter, View } from '~/models';
import { MetaTable } from '~/cli';
import Noco from '~/Noco';

type GetRowColorConditionsResult = {
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
    const context = this.context;
    const { ncMeta } = this.props;
    const viewIds = views.map((k) => k.id);
    const rowColoringConditions = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.ROW_COLOR_CONDITIONS,
      {
        xcCondition: (qb) => {
          qb.whereIn('fk_view_id', viewIds);
        },
      },
    );
    const rowColoringConditionViewIdMap = rowColoringConditions.reduce<
      Record<string, RowColorCondition[]>
    >((acc, cur) => {
      if (!acc[cur.fk_view_id]) {
        acc[cur.fk_view_id] = [];
      }
      acc[cur.fk_view_id].push(cur);
      return acc;
    }, {});
    const rowColoringConditionIds = rowColoringConditions.map((rc) => rc.id);
    if (rowColoringConditionIds.length > 0) {
      const filters = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          xcCondition: (qb) => {
            qb.whereIn('fk_row_color_condition_id', rowColoringConditionIds);
          },
        },
      );
      const filterRowColorConditionIdMap = filters.reduce<
        Record<string, Filter[]>
      >((acc, cur) => {
        if (!acc[cur.fk_row_color_condition_id]) {
          acc[cur.fk_row_color_condition_id] = [];
        }
        acc[cur.fk_row_color_condition_id].push(cur);
        return acc;
      }, {});

      return views.map((v) => ({
        view: v,
        rowColoringConditions: (rowColoringConditionViewIdMap[v.id] ?? []).map(
          (rowColor) => {
            return {
              record: rowColor,
              filters: filterRowColorConditionIdMap[rowColor.id] ?? [],
            };
          },
        ),
      }));
    } else {
      return views.map((v) => ({
        view: v,
        rowColoringConditions: [],
      }));
    }
  }

  async randomizeRowColorConditionId(payload: GetRowColorConditionsResult) {
    const { ncMeta } = this.props;
    return (await Promise.all(
      payload.map(async (viewRow) => {
        return {
          view: viewRow.view,
          rowColoringConditions: await Promise.all(
            viewRow.rowColoringConditions.map(async (rowColor) => {
              const id = await ncMeta.genNanoid(MetaTable.ROW_COLOR_CONDITIONS);
              return {
                record: {
                  ...rowColor.record,
                  id,
                },
                filters: await Promise.all(
                  rowColor.filters.map(async (filter) => {
                    const filterId = await ncMeta.genNanoid(
                      MetaTable.FILTER_EXP,
                    );
                    return {
                      ...filter,
                      id: filterId,
                      fk_row_color_condition_id: id,
                    };
                  }),
                ),
              };
            }),
          ),
        };
      }),
    )) as GetRowColorConditionsResult;
  }

  async getDuplicateRowColorConditions(
    views: {
      view: View;
      toViewId: string;
    }[],
  ) {
    const actualRecords = await this.getRowColorConditions(
      views.map((view) => view.view),
    );
    const viewIdMap = views.reduce<Record<string, string>>((acc, cur) => {
      acc[cur.view.id] = cur.toViewId;
      return acc;
    }, {});
    const randomized = await this.randomizeRowColorConditionId(actualRecords);
    const rowColors: RowColorCondition[] = [];
    const filters: Filter[] = [];
    for (const v of randomized) {
      for (const rc of v.rowColoringConditions) {
        rowColors.push({ ...rc.record, fk_view_id: viewIdMap[v.view.id] });
        for (const filter of rc.filters) {
          filters.push(filter);
        }
      }
    }
    return {
      result: randomized,
      filters,
      rowColorConditions: rowColors,
    };
  }
  mapMetaColumn(payload: { meta?: any; idMap: Map<string, string> }) {
    if (!payload.meta) {
      return payload.meta;
    }
    if (parseProp(payload.meta).rowColoringInfo) {
      return {
        ...payload.meta,
        rowColoringInfo: {
          ...payload.meta.rowColoringInfo,
          fk_column_id: payload.idMap.get(
            payload.meta.rowColoringInfo.fk_column_id,
          ),
        },
      };
    }
    return payload.meta;
  }
}
