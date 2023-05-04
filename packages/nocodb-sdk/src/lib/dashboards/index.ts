// import { ProjectType } from '../Api';

import { AggregateFnType, DashboardWidgetVisualisationTypeType } from '../Api';

// // export interface DashboardsProject extends Omit<ProjectType, 'bases'> {
// //   id: string;
// //   title?: string;
// // //   datasource_projects?: ProjectType[];
// // //   type: 'DashboardsProject';
// // }
// // => Instead of adding a new explicit DashboardsProject type: let's use the existing one and
// // * add CRUD enpoints widgets of a Dashboard (backend would throw error if respective project is not of type DashboardsProject)

// // SCRATCH PAD:

// type ColId = string;
// type ColOrValue = ColId | string;

// export type InfixOperator = '=' | '!=' | '>' | '<'; // ...
// export interface SingleTerm {
//   leftColOrValue: ColOrValue;
//   operator: InfixOperator;
//   rightColOrValue: ColOrValue;
// }
// export type ConjunctionOperator = 'AND' | 'OR';
// export interface ConjunctionTerm {
//   leftTerm: FilterTerm;
//   conjunctionOperator: ConjunctionOperator;
//   rightTerm: FilterTerm;
// }

// export type FilterTerm = ConjunctionTerm | SingleTerm;

// export interface Dashboard {
//   project_id: string; // or directly linking the ProjectType here?
//   name: string;
//   description: string;
//   widgets: DashboardWidget<any, any>[];
// }

// export enum DashboardWidgetType {
//   // CHART_NON_AGGREGATED = "chart_non_aggregated",
//   // CHART_AGGREGATED = "chart_aggregated",
//   CHART_BAR = 'chart_bar',
//   CHART_LINE = 'chart_line',
//   CHART_PIE = 'chart_pie',
//   CHART_SCATTER = 'chart_scatter',
//   NUMBER = 'number',
//   BUTTON = 'button',
//   TEXT_BLOCK = 'text_block',
// }

// export enum DashboardWidgetDataCallType {
//   INTERNAL_API = 'internal_api',
//   EXTERNAL_API = 'external_api',
//   SQL = 'sql',
// }

// export enum AggregateFunction {
//   SUM = 'sum',
//   AVG = 'avg',
//   MAX = 'max',
//   MIN = 'min',
//   COUNT = 'count',
//   DISTINCT = 'distinct',
// }

// export interface DashboardWidgetDataRequestInternalAPIFilterConfig {
//   rootFilterClause: FilterTerm;
// }

// // export interface DashboardWidgetDataRequestInternalAPIDataPointConfigBase {
// //     type
// // }
// export interface DashboardWidgetDataRequestExternalAPIDataPointConfigForNumber {
//   //   extends DashboardWidgetDataRequestInternalAPIDataPointConfigBase {
//   aggregateFn: AggregateFunction;
//   columnId: string;
//   someExternalSpecificProperty: string;
//   //   filterConfig: DashboardWidgetDataRequestExternalAPIFilterConfig;
// }
// export interface DashboardWidgetDataRequestInternalAPIDataPointConfigForNumber {
//   //   extends DashboardWidgetDataRequestInternalAPIDataPointConfigBase {
//   aggregateFn: AggregateFunction;
//   columnId: string;
//   filterConfig: DashboardWidgetDataRequestInternalAPIFilterConfig;
// }

// export type DashboardWidgetDataRequestExternalAPIDataPointConfig =
//   DashboardWidgetDataRequestExternalAPIDataPointConfigForNumber;

// export type DashboardWidgetDataRequestInternalAPIDataPointConfig =
//   DashboardWidgetDataRequestInternalAPIDataPointConfigForNumber;

// export interface DashboardWidgetDataRequestExternalAPI<
//   T extends DashboardWidgetDataRequestExternalAPIDataPointConfig
// > {
//   //   type: 'aggregate'; // aggregate, list, read, graph
//   callType: DashboardWidgetDataCallType.EXTERNAL_API;
//   apiUrl: string;
//   dataPoints: T;
// }

// export interface DashboardWidgetDataRequestInternalAPI<
//   T extends DashboardWidgetDataRequestInternalAPIDataPointConfig
// > {
//   //   type: 'aggregate'; // aggregate, list, read, graph
//   callType: DashboardWidgetDataCallType.INTERNAL_API;
//   projectId: string;
//   baseId: string;
//   tableId: string;
//   viewId: string;
//   dataPoints: T;
// }

// type DashboardWidgetDataRequest<
//   T extends DashboardWidgetDataRequestInternalAPIDataPointConfig,
//   T2 extends DashboardWidgetDataRequestExternalAPIDataPointConfig
// > =
//   | DashboardWidgetDataRequestInternalAPI<T>
//   | DashboardWidgetDataRequestExternalAPI<T2>;

// export interface DashboardWidget<
//   T extends DashboardWidgetDataRequestInternalAPIDataPointConfig,
//   T2 extends DashboardWidgetDataRequestExternalAPIDataPointConfig
// > {
//   id: string;
//   type: DashboardWidgetType;
//   version: string;
//   name: string;
//   description?: string;
//   data_config: {
//     request: DashboardWidgetDataRequest<T, T2>;
//   };
// }

// export interface DashboardNumberWidget
//   extends DashboardWidget<
//     DashboardWidgetDataRequestInternalAPIDataPointConfigForNumber,
//     DashboardWidgetDataRequestExternalAPIDataPointConfigForNumber
//   > {
//   type: DashboardWidgetType.NUMBER;
//   data_config: {
//     request:
//       | DashboardWidgetDataRequestInternalAPI<DashboardWidgetDataRequestInternalAPIDataPointConfigForNumber>
//       | DashboardWidgetDataRequestExternalAPI<DashboardWidgetDataRequestExternalAPIDataPointConfigForNumber>;
//   };
// }

// // export interface DashboardLineChartWidget extends DashboardWidget< {
// //   type: DashboardWidgetType.CHART_LINE;
// //   data_config: {
// //     request: {

// //     }
// //   };
// // }

// // const dashboardLineChartWidgetWithInternalAPICall: DashboardLineChartWidget = {
// //   id: 'id-2',
// //   version: 'v-1',
// //   name: 'Name of Number Line Chart Widget 1',
// //   description: 'Some description',
// //   data_config:
// // }

// const dashboardNumberWidgetWithInternalAPICall: DashboardNumberWidget = {
//   id: 'id-1',
//   version: 'v-1',
//   name: 'Name of Number Widget 1',
//   description: 'Some description',
//   type: DashboardWidgetType.NUMBER,
//   data_config: {
//     request: {
//       projectId: 'pr-1',
//       baseId: 'b-1',
//       tableId: 'table-1',
//       viewId: 'view-1',
//       dataPoints: {
//         aggregateFn: AggregateFunction.AVG,
//         columnId: '12345',
//         filterConfig: {
//           rootFilterClause: {
//             leftColOrValue: 'col1',
//             operator: '=',
//             rightColOrValue: 'col2',
//           } as SingleTerm,
//         },
//       },
//       //   filterConfig: {
//       //     rootFilterClause: {
//       //       leftColOrValue: 'col1',
//       //       operator: '=',
//       //       rightColOrValue: 'col2',
//       //     } as SingleTerm,
//       //   },
//     } as DashboardWidgetDataRequestInternalAPI<DashboardWidgetDataRequestInternalAPIDataPointConfigForNumber>,
//   },
// };

// dashboardNumberWidgetWithInternalAPICall.data_config.request.callType

// DECIDED:
// export enum AggregateFunction {
//   SUM = 'sum',
//   AVG = 'avg',
//   MAX = 'max',
//   MIN = 'min',
//   COUNT = 'count',
//   DISTINCT = 'distinct',
// }

// export enum VisualisationType {
//   NUMBER = 'number',
//   STATIC_TEXT = 'static_text',
//   LINE_CHART = 'line_chart',
//   BAR_CHART = 'bar_chart',
//   PIE_CHART = 'pie_chart',
//   SCATTER_PLOT = 'scatter_plot',
//   BUTTON = 'button',
// }

export enum DataSourceType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  SQL = 'sql',
  STATIC_CONTENT = 'static_content',
}

export interface InternalDataSource {
  dataSourceType: DataSourceType.INTERNAL;

  projectId?: string;
  tableId?: string;
  viewId?: string;
}

export interface ExternalDataSource {
  dataSourceType: DataSourceType.EXTERNAL;

  endpointUrl?: string;
}

export interface SQLDataSource {
  dataSourceType: DataSourceType.SQL;

  sqlStatement?: string;
}

export interface StaticContentDataSource {
  dataSourceType: DataSourceType.STATIC_CONTENT;
  staticContent: string;
}

export type DataSource =
  | InternalDataSource
  | ExternalDataSource
  | SQLDataSource
  | StaticContentDataSource;

export type DataConfigBase = {
  //   visualisation_type: VisualisationType;
};

export interface NumberDataConfig extends DataConfigBase {
  //   visualisation_type: VisualisationType.NUMBER;
  colId?: string;
  aggregateFunction?: AggregateFnType;
}

export interface StaticTextDataConfig extends DataConfigBase {
  //   visualisation_type: VisualisationType.STATIC_TEXT;
  text?: string;
}

export interface Aggregated2DChartDataConfig extends DataConfigBase {
  xAxisColId?: string;
  yAxisColId?: string;
  aggregateFunction?: AggregateFnType;
}
export type BarChartDataConfig = Aggregated2DChartDataConfig;

export type LineChartDataConfig = Aggregated2DChartDataConfig;

export type PieChartDataConfig = Aggregated2DChartDataConfig;

export interface ScatterPlotDataConfig extends DataConfigBase {
  xAxisColId?: string;
  yAxisColId?: string;
}

// Similar definitions for LineChartDataConfig, PieChartDataConfig, and ScatterPlotDataConfig

export type DataConfig =
  | NumberDataConfig
  | StaticTextDataConfig
  | BarChartDataConfig
  | LineChartDataConfig
  | PieChartDataConfig
  | ScatterPlotDataConfig;

export interface ScreenPosition {
  x: number;
  y: number;
}

export interface ScreenDimensions {
  height: number;
  width: number;
}

export enum FontType {
  HEADING1 = 'heading1',
  HEADING2 = 'heading2',
  HEADING3 = 'heading3',
  SUB_HEADING_1 = 'subHeading1',
  SUB_HEADING_2 = 'subHeading2',
  BODY = 'body',
  CAPTION = 'caption',
}

export interface StaticTextAppearanceConfig extends BaseAppearanceConfig {
  fontType?: FontType;
}

export interface BaseAppearanceConfig {
  name: string;
  description?: string;
  screenDimensions: ScreenDimensions;
  screenPosition: ScreenPosition;
}

export type AppearanceConfig = StaticTextAppearanceConfig;

export interface DashboardWidget {
  id: string;
  schema_version: string;
  data_config?: DataConfig;
  data_source?: DataSource;
  visualisation_type: DashboardWidgetVisualisationTypeType;
  appearance_config: AppearanceConfig;
}

export interface NumberDashboardWidget extends DashboardWidget {
  data_config: NumberDataConfig;
  visualisation_type: DashboardWidgetVisualisationTypeType.Number;
}

export interface ChartDashboardWidget extends DashboardWidget {
  data_config: Aggregated2DChartDataConfig;
  visualisation_type:
    | DashboardWidgetVisualisationTypeType.LineChart
    | DashboardWidgetVisualisationTypeType.BarChart
    | DashboardWidgetVisualisationTypeType.PieChart;
}

export const chartVisualisationTypes = [
  DashboardWidgetVisualisationTypeType.LineChart,
  DashboardWidgetVisualisationTypeType.BarChart,
  DashboardWidgetVisualisationTypeType.PieChart,
  DashboardWidgetVisualisationTypeType.ScatterPlot,
];

export interface WidgetDataResult {
  dashboardId: string;
  widgetId: string;
  // visualisation_type: VisualisationType;
  // data_source: DataSource;
  // data_config: DataConfig;
}

export interface NumberWidgetDataResult extends WidgetDataResult {
  columnName: string;
  aggregateFunction: AggregateFnType;
  value: string | number | boolean;
}

export interface ChartWidgetDataResult extends WidgetDataResult {
  xColumnName: string;
  yColumnName: string;
  aggregateFunction: AggregateFnType;
  values: number[];
}

// const FOO: DashboardWidget = {
//   id: 'id-1',
//   version: 'v-1',
//   name: 'Name of Number Widget 1',
//   description: 'Some description',
//   posX: 12,
//   posY: 34,
//   width: 200,
//   height: 300,
//   data_config: {
//     dataSourceType: DataSourceType.SQL,
//     sqlStatement: 'asdad',
//     visualisation_type: VisualisationType.NUMBER,
//     colId: 'col-id-1',
//     aggregateFunction: AggregateFunction.AVG,
//   },
// };
