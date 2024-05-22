import { Injectable } from '@nestjs/common';
import { DataSourceType, WidgetTypeType } from 'nocodb-sdk';
import { WidgetsService } from './widgets.service';
import type { PathParams } from '~/helpers/dataHelpers';
import type {
  AppearanceConfig,
  ChartWidget,
  ChartWidgetDataResult,
  DataConfig,
  DataSource,
  DataSourceInternal,
  NumberWidget,
  NumberWidgetDataResult,
  WidgetType,
} from 'nocodb-sdk';
import { getViewAndModelByAliasOrId } from '~/helpers/dataHelpers';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import Widget from '~/models/Widget';
import { Column, Filter, Model, Source, View } from '~/models';

const _parseWidgetFromAPI = (widgetFromAPI: WidgetType): Widget => {
  // TODO: improve parsing, e.g. via 3rd party library (is AJV a candidate here?)
  // TODO: Also, consider to move this parsing logic into SDK so it can also be used by the BE
  const dataConfig: DataConfig =
    typeof widgetFromAPI.data_config === 'object'
      ? widgetFromAPI.data_config
      : JSON.parse(widgetFromAPI.data_config || '{}');

  const dataSource: DataSource =
    typeof widgetFromAPI.data_source === 'object'
      ? widgetFromAPI.data_source
      : JSON.parse(widgetFromAPI.data_source || '{}');

  const appearanceConfig: AppearanceConfig =
    typeof widgetFromAPI.appearance_config === 'object'
      ? widgetFromAPI.appearance_config
      : JSON.parse(widgetFromAPI.appearance_config || '{}');

  return {
    ...widgetFromAPI,
    data_config: dataConfig,
    data_source: dataSource,
    appearance_config: appearanceConfig,
  };
};

@Injectable()
export class WidgetDataService {
  async getWidgetData({
    layoutId,
    widgetId,
  }: {
    layoutId: string;
    widgetId: string;
    req?: any;
  }) {
    const rawWidget = await Widget.get(widgetId);
    const widget = _parseWidgetFromAPI(rawWidget);
    // TODO: later apply here better structure / something like command pattern etc
    // * QUICKLY/TIMEBOXED consider to use JSON parsing/validation library
    if (widget.data_source.dataSourceType === DataSourceType.INTERNAL) {
      const data_source: DataSourceInternal = widget.data_source;
      // * check which view is used for the widget
      // THE FOLLOWING BLOCK COULD BE MINIFIED FOR NOW / POC SAKE
      // * check if layout editor (OR THE Dashboard Base?) has acces to DB base of the view
      //   * for that it's probably needed to save either
      //     * a) the layout editor user-id in the Layout
      //     * b) to somehow save the base-ids that the Layout should have access to already now
      //          => that way, the access right is not tied to one particular layout editor user
      //             (who could be removed from the layout base at some point)
      //             and the whole base could indpendently of one user be reconfigured regarding which resources it has access to

      switch (widget.widget_type) {
        case WidgetTypeType.Number: {
          const numberWidget: NumberWidget = widget as NumberWidget;
          const { baseId, tableId, viewId } = data_source;
          const { recordCountOrFieldSummary } = numberWidget.data_config;

          let aggregateColumnName, aggregateFunction;
          if (recordCountOrFieldSummary === 'field_summary') {
            aggregateFunction = numberWidget.data_config.aggregateFunction;

            const view = await View.get(viewId);
            await view.getColumns();

            const aggregateColumn = await Column.get({
              colId: numberWidget.data_config.colId,
            });

            aggregateColumnName = aggregateColumn?.column_name;
          } else {
            aggregateFunction = 'count';
            aggregateColumnName = '*';
          }

          const ignoreFilters =
            numberWidget.data_config.selectRecordsMode === 'all_records';

          WidgetsService.validateWidgetDataSourceConfig(
            widget.data_source,
            layoutId,
          );
          const widgetData = await this.dataGroupAndAggregateBy({
            widget,
            query: undefined,
            baseName: baseId,
            tableName: tableId,
            viewName: viewId,
            aggregateColumnName: aggregateColumnName,
            aggregateFunction: aggregateFunction,
            ignoreFilters,
          });

          const result =
            widgetData.list[0][`${aggregateFunction}__${aggregateColumnName}`];

          return {
            value: result,
            widgetId,
            layoutId,
            aggregateFunction,
            columnName: aggregateColumnName,
          } as NumberWidgetDataResult;
        }
        case WidgetTypeType.BarChart:
        case WidgetTypeType.LineChart:
        case WidgetTypeType.PieChart:
        case WidgetTypeType.ScatterPlot: {
          const chartWidget = widget as ChartWidget;
          const { baseId, tableId, viewId } = data_source;
          const {
            xAxisColId,
            recordCountOrFieldSummary,
            xAxisOrderBy,
            xAxisOrderDirection,
          } = chartWidget.data_config;

          const view = await View.get(viewId);
          await view.getColumns();

          let aggregateColumnName, aggregateFunction;
          if (recordCountOrFieldSummary === 'field_summary') {
            const aggregateColumnId = chartWidget.data_config.yAxisColId;

            const aggregateColumn = await Column.get({
              colId: aggregateColumnId,
            });

            aggregateFunction = chartWidget.data_config.aggregateFunction;
            aggregateColumnName = aggregateColumn?.column_name;
          } else {
            aggregateFunction = 'count';
            aggregateColumnName = '*';
          }

          const groupByColumnId = xAxisColId;

          const groupByColumnName = (
            await Column.get({
              colId: groupByColumnId,
            })
          ).column_name;

          const sortByColName =
            xAxisOrderBy === 'x_val'
              ? groupByColumnName
              : `${aggregateFunction}__${aggregateColumnName}`;
          // const sort = `${sortByColName} ${xAxisOrderDirection}`;

          const ignoreFilters =
            chartWidget.data_config.selectRecordsMode === 'all_records';

          const widgetData = await this.dataGroupAndAggregateBy({
            widget,
            query: undefined,
            baseName: baseId,
            tableName: tableId,
            viewName: viewId,
            aggregateColumnName,
            aggregateFunction: aggregateFunction,
            groupByColumnName,
            ignoreFilters,
            ...(sortByColName
              ? {
                  sort: {
                    column_name: sortByColName,
                    direction: xAxisOrderDirection,
                  },
                }
              : {}),
          });

          return {
            aggregateFunction: aggregateFunction,
            xColumnName: groupByColumnName,
            yColumnName: aggregateColumnName,
            values: widgetData.list,
          } as ChartWidgetDataResult;
        }
      }
    }

    throw new Error(
      'Not implemented yet for this VisualisationType/DataSource combination',
    );
  }

  async dataGroupAndAggregateBy(
    param: PathParams & {
      widget: Widget;
      query: any;
      groupByColumnName?: string;
      aggregateColumnName: string;
      aggregateFunction: string;
      ignoreFilters?: boolean;
      sort?: {
        column_name: string;
        direction: 'asc' | 'desc';
      };
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);
    return await this.getDataAggregateBy({
      model,
      view,
      ...param,
    });
  }

  async getDataAggregateBy(param: {
    widget: Widget;
    model: Model;
    view: View;
    query?: any;
    aggregateColumnName: string;
    aggregateFunction: string;
    groupByColumnName?: string;
    ignoreFilters?: boolean;
    sort?: {
      column_name: string;
      direction: 'asc' | 'desc';
    };
  }) {
    const { model, view, query = {} } = param;

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const widgetFilterArr = param.ignoreFilters
      ? []
      : await Filter.rootFilterListByWidget({
          widgetId: param.widget.id,
        });

    const data = await baseModel.groupByAndAggregate(
      param.aggregateColumnName,
      param.aggregateFunction,
      {
        groupByColumnName: param.groupByColumnName,
        widgetFilterArr,
        sortBy: param.sort,
        ...query,
      },
    );

    return new PagedResponseImpl(data, {
      ...query,
    });
  }
}
