import { ChartTypes, formatAggregation } from 'nocodb-sdk';
import type { NcContext, NcRequest, WidgetType, WidgetTypes } from 'nocodb-sdk';
import { Column, Filter, Model, Source, View } from '~/models';
import applyAggregation, { validateAggregationColType } from '~/db/aggregation';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { getColumnNameQuery } from '~/db/getColumnNameQuery';

export class PieChartCommonHandler {
  async validateWidgetData(
    context: NcContext,
    widget: WidgetType<WidgetTypes.CHART>,
  ) {
    const errors = [];

    const addError = (path: string, message: string) => {
      errors.push({ path, message });
    };

    if (widget.config.chartType !== ChartTypes.PIE) {
      addError('chartType', 'Chart type must be pie');
      return errors;
    }

    const { dataSource, data } = widget.config;

    if (!widget?.fk_model_id) {
      addError('widget.fk_model_id', 'Model ID is required');
      return errors;
    }

    const model = await Model.getByIdOrName(context, {
      id: widget.fk_model_id,
    });
    if (!model) {
      addError('widget.fk_model_id', 'Model not found');
      return errors;
    }

    if (dataSource === 'view' && widget.fk_view_id) {
      const view = await View.get(context, widget.fk_view_id);
      if (!view) {
        addError('widget.fk_view_id', 'View not found');
      }
    }

    if (!data) {
      addError('data', 'Data is required');
      return errors;
    }

    const { category, value } = data;

    if (!category) {
      addError('data.category', 'Category is required');
      return errors;
    }

    if (!value) {
      addError('data.value', 'Value is required');
      return errors;
    }

    if (!category.column_id) {
      addError('data.category.column_id', 'Column ID is required');
      return errors;
    }

    const categoryColumn = await Column.get(context, {
      colId: category.column_id,
    });

    if (!categoryColumn) {
      addError('data.category.column_id', 'Column not found');
      return errors;
    }

    if (
      category.orderBy &&
      !['default', 'asc', 'desc'].includes(category.orderBy)
    ) {
      addError(
        'data.category.orderBy',
        'Order by must be default, asc or desc',
      );
    }

    if (!value.type) {
      addError('data.value.type', 'Value type is required');
      return errors;
    }

    if (!['count', 'summary'].includes(value.type)) {
      addError('data.value.type', 'Value type must be count or summary');
    }

    if (value.type === 'summary') {
      if (!value.column_id) {
        addError(
          'data.value.column_id',
          'Column ID is required for summary type',
        );
        return errors;
      }

      const column = await Column.get(context, { colId: value.column_id });
      if (!column) {
        addError('data.value.column_id', 'Column not found');
      } else if (
        !validateAggregationColType(
          column,
          value.aggregation as unknown as string,
          false,
        )
      ) {
        addError(
          'data.value.aggregation',
          'Aggregation is not valid for this column',
        );
      }
    }

    return errors.length > 0 ? errors : undefined;
  }

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
      console.log(view);
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
