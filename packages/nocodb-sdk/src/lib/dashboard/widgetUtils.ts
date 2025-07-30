import { ChartTypes, WidgetDataSourceTypes, WidgetType, WidgetTypes } from '.';
import { ColumnType, UITypes } from '~/lib';

export const calculateNextPosition = (
  existingWidgets: WidgetType[],
  newWidgetDimensions: { w: number; h: number },
  gridColumns: number = 4
) => {
  if (existingWidgets.length === 0) {
    return { x: 0, y: 0 };
  }

  const { w: newW, h: newH } = newWidgetDimensions;

  // Early return if widget is too wide
  if (newW > gridColumns) {
    return { x: 0, y: 0 };
  }

  // Create a 2D grid to track occupied cells more efficiently
  const grid = new Map<number, Set<number>>();
  let maxY = 0;

  // Build the occupation map
  for (const widget of existingWidgets) {
    const { x, y, w, h } = widget.position;
    const endY = y + h;
    maxY = Math.max(maxY, endY);

    for (let row = y; row < endY; row++) {
      if (!grid.has(row)) {
        grid.set(row, new Set());
      }
      const rowSet = grid.get(row)!;
      for (let col = x; col < x + w; col++) {
        rowSet.add(col);
      }
    }
  }

  // position checking
  const isPositionAvailable = (x: number, y: number): boolean => {
    for (let row = y; row < y + newH; row++) {
      const rowSet = grid.get(row);
      if (rowSet) {
        for (let col = x; col < x + newW; col++) {
          if (rowSet.has(col)) return false;
        }
      }
    }
    return true;
  };

  // Find the first available position, scanning row by row
  const maxX = gridColumns - newW;
  for (let y = 0; y <= maxY + 1; y++) {
    for (let x = 0; x <= maxX; x++) {
      if (isPositionAvailable(x, y)) {
        return { x, y };
      }
    }
  }

  // Fallback: place at bottom-left
  return { x: 0, y: maxY };
};

const getDefaultConfig = (
  widgetType: WidgetTypes,
  chartType?: ChartTypes,
  columns?: Array<ColumnType>
) => {
  switch (widgetType) {
    case WidgetTypes.METRIC:
      return {
        dataSource: WidgetDataSourceTypes.MODEL,
        metric: {
          type: 'count' as const,
          aggregation: 'count' as const,
        },
        appearance: {
          type: 'filled' as const,
          theme: 'purple' as const,
        },
      };

    case WidgetTypes.CHART:
      return getDefaultChartConfig(chartType, columns);

    default:
      return {};
  }
};

const getDefaultChartConfig = (
  chartType?: ChartTypes,
  columns?: Array<ColumnType>
) => {
  const baseConfig = {
    dataSource: WidgetDataSourceTypes.MODEL,
  };

  // Helper function to get the best column for category field
  const getDefaultCategoryColumn = (columns?: Array<ColumnType>): string => {
    if (!columns || columns?.length === 0) return '';

    // Priority 1: SingleSelect
    const singleSelectColumn = columns.find(
      (col) => col.uidt === UITypes.SingleSelect
    );
    if (singleSelectColumn) return singleSelectColumn.id;

    // Priority 2: SingleLineText
    const singleLineTextColumn = columns.find(
      (col) => col.uidt === UITypes.SingleLineText
    );
    if (singleLineTextColumn) return singleLineTextColumn.id;

    // Fallback: first column
    return columns[0]?.id || '';
  };

  switch (chartType) {
    case ChartTypes.PIE:
      return {
        ...baseConfig,
        chartType: ChartTypes.PIE,
        data: {
          category: {
            column_id: getDefaultCategoryColumn(columns),
            orderBy: 'default' as const,
            includeEmptyRecords: false,
          },
          value: {
            type: 'count' as const,
          },
        },
        appearance: {
          size: 'medium' as const,
          showCountInLegend: true,
          showPercentageOnChart: true,
          legendPosition: 'right' as const,
          colorSchema: 'default' as const,
          customColorSchema: [],
        },
        permissions: {
          allowUserToPrint: true,
          allowUsersToViewRecords: false,
        },
      };

    case ChartTypes.DONUT:
      return {
        ...baseConfig,
        chartType: ChartTypes.DONUT,
        data: {
          category: {
            column_id: getDefaultCategoryColumn(columns),
            orderBy: 'default' as const,
            includeEmptyRecords: false,
          },
          value: {
            type: 'count' as const,
          },
        },
        appearance: {
          size: 'medium' as const,
          showCountInLegend: true,
          showPercentageOnChart: true,
          legendPosition: 'right' as const,
          colorSchema: 'default' as const,
          customColorSchema: [],
        },
        permissions: {
          allowUserToPrint: true,
          allowUsersToViewRecords: false,
        },
      };

    default:
      return {
        ...baseConfig,
        chartType,
      };
  }
};

export { getDefaultConfig };
