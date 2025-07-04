import { ChartTypes, formatAggregation } from 'nocodb-sdk';
import { PieChartCommonHandler } from './pie-chart.common.handler';
import type { NcRequest, WidgetType, WidgetTypes } from 'nocodb-sdk';
import { Column, Filter, Model, Source, View } from '~/models';
import applyAggregation from '~/db/aggregation';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { getColumnNameQuery } from '~/db/getColumnNameQuery';
export class PieChartPgHandler extends PieChartCommonHandler {
  async getWidgetData(params: {
    widget: WidgetType<WidgetTypes.CHART>;
    req: NcRequest;
  }) {
    const { widget, req } = params;
    const context = req.context;
    const { config } = widget;

    if (!config.chartType || config.chartType !== ChartTypes.PIE) {
      return { data: [] };
    }

    const { dataSource, data: chartData } = config;

    const model = await Model.getByIdOrName(context, {
      id: widget.fk_model_id,
    });

    let view = null;
    if (dataSource === 'view' && widget.fk_view_id) {
      view = await View.get(context, widget.fk_view_id);
    }
    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const categoryColumn = await Column.get(context, {
      colId: chartData.category.column_id,
    });

    const filters = await Filter.rootFilterListByWidget(context, {
      widgetId: widget.id,
    });

    const qb = baseModel.dbDriver(baseModel.tnPath);

    await baseModel.applySortAndFilter({
      table: model,
      qb,
      filters,
      view,
      skipSort: true,
      sort: '',
      where: '',
    });

    const categoryColumnNameQuery = await getColumnNameQuery({
      baseModelSqlv2: baseModel,
      column: categoryColumn,
      context: req.context,
    });

    qb.groupBy(categoryColumnNameQuery);

    qb.select(
      baseModel.dbDriver.raw('?? as ??', [categoryColumnNameQuery, 'category']),
    );

    let aggregationColumn = null;
    const aggregationAlias = 'value';

    if (chartData.value.type === 'count') {
      qb.count(`* as ${aggregationAlias}`);
    } else if (chartData.value.type === 'summary') {
      aggregationColumn = await Column.get(context, {
        colId: chartData.value.column_id,
      });

      const aggSql = await applyAggregation({
        baseModelSqlv2: baseModel,
        aggregation: chartData.value.aggregation as unknown as string,
        column: aggregationColumn,
        alias: aggregationAlias,
      });

      qb.select(baseModel.dbDriver.raw(aggSql));
    }

    if (
      chartData.category.orderBy &&
      chartData.category.orderBy !== 'default'
    ) {
      if (chartData.category.orderBy === 'asc') {
        qb.orderBy(categoryColumnNameQuery, 'ASC');
      } else if (chartData.category.orderBy === 'desc') {
        qb.orderBy(categoryColumnNameQuery, 'DESC');
      }
    } else {
      qb.orderBy(aggregationAlias, 'DESC');
    }

    if (!chartData.category?.includeEmptyRecords) {
      qb.whereNotNull(categoryColumnNameQuery);
      qb.where(categoryColumnNameQuery, '!=', '');
    }
    const rawData = await baseModel.execAndParse(qb, null, {
      skipDateConversion: true,
      skipAttachmentConversion: true,
      skipUserConversion: true,
    });

    const formattedData = rawData.map((row: any) => {
      let value = row[aggregationAlias];

      if (chartData.value.type === 'summary' && aggregationColumn) {
        value = formatAggregation(
          chartData.value.aggregation,
          value,
          aggregationColumn,
        );
      }

      return {
        name: row.category || 'Unknown',
        value: value || 0,
        category: row.category,
      };
    });

    return {
      data: formattedData,
      category_column: categoryColumn.title,
      value_column: aggregationColumn?.title || null,
    };
  }
}
