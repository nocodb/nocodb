import { ChartTypes, TextWidgetTypes } from 'nocodb-sdk'

export const chartIconMap = {
  [ChartTypes.BAR]: 'ncChartBar',
  [ChartTypes.LINE]: 'ncChartLine',
  [ChartTypes.PIE]: 'ncChartPie',
  [ChartTypes.DONUT]: 'ncChartDonut',
  [ChartTypes.SCATTER]: 'ncChartScatterPlot',
}

export const textIconMap = {
  [TextWidgetTypes.Markdown]: 'cellLongText',
  [TextWidgetTypes.Text]: 'cellText',
}

export const textLabelMap = {
  [TextWidgetTypes.Markdown]: 'Markdown',
  [TextWidgetTypes.Text]: 'Text',
}
