import { type NcContext, parseProp } from 'nocodb-sdk';
import { RowColorViewHelpers as RowColorViewHelpersCE } from 'src/helpers/rowColorViewHelpers';
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

export class RowColorViewHelpers extends RowColorViewHelpersCE {
  protected constructor(
    protected readonly context: NcContext,
    protected props: {
      ncMeta: MetaService;
    },
  ) {
    super(context, props);
  }
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

  async viewDeleted(view: View) {
    const context = this.context;
    const { ncMeta } = this.props;

    const rowColorConditions = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.ROW_COLOR_CONDITIONS,
      {
        condition: {
          fk_view_id: view.id,
        },
      },
    );
    const rowColorConditionIds = rowColorConditions.map((k) => k.id);

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.ROW_COLOR_CONDITIONS,
      {
        fk_view_id: view.id,
      },
    );
    // TODO: should be able delete where in
    for (const rc of rowColorConditionIds) {
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          fk_row_color_condition_id: rc,
        },
      );
    }
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
    const filterIdMap = new Map<string, string>();
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
                filters: (
                  await Promise.all(
                    rowColor.filters.map(async (filter) => {
                      const newFilterId = await ncMeta.genNanoid(
                        MetaTable.FILTER_EXP,
                      );
                      filterIdMap.set(filter.id, newFilterId);
                      return {
                        ...filter,
                        id: newFilterId,
                        fk_row_color_condition_id: id,
                      };
                    }),
                  )
                ).map((filter) => {
                  return {
                    ...filter,
                    fk_parent_id: filter.fk_parent_id
                      ? filterIdMap.get(filter.fk_parent_id)
                      : filter.fk_parent_id,
                  };
                }),
              };
            }),
          ),
        };
      }),
    )) as GetRowColorConditionsResult;
  }

  async getDuplicateRowColorConditions(param: {
    views: View[];
    idMap: Map<string, string>;
    mapColumnId?: boolean;
  }) {
    const { views, idMap, mapColumnId } = param;
    const actualRecords = await this.getRowColorConditions(views);
    const randomized = await this.randomizeRowColorConditionId(actualRecords);
    const rowColors: RowColorCondition[] = [];
    const filters: Filter[] = [];
    for (const v of randomized) {
      for (const rc of v.rowColoringConditions) {
        rowColors.push({ ...rc.record, fk_view_id: idMap.get(v.view.id) });
        for (const filter of rc.filters) {
          filters.push({
            ...filter,
            ...(mapColumnId
              ? {
                  fk_column_id: idMap.get(filter.fk_column_id),
                  fk_parent_column_id: idMap.get(filter.fk_parent_column_id),
                }
              : {}),
          } as Filter);
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
