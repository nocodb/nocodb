import type { DataConfigAggregated2DChart, DataConfigNumber, DataConfigStaticText, DataSourceInternal, Widget } from 'nocodb-sdk'
import { WidgetTypeType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'

export const useWidget = (widgetConfig: Ref<Widget>) => {
  const dataLinkConfigIsMissing: ComputedRef<boolean> = computed(() => {
    // TODO: adapt this, once we support also external data sources
    const data_source = widgetConfig.value?.data_source as DataSourceInternal

    if ([WidgetTypeType.StaticText, WidgetTypeType.Image].includes(widgetConfig.value.widget_type)) {
      switch (widgetConfig.value.widget_type) {
        case WidgetTypeType.StaticText: {
          return !(widgetConfig.value?.data_config as DataConfigStaticText)?.text
        }
        default: {
          // TODO: Implement this for other widget types as well
          return true
        }
      }
    }

    if (!data_source || !data_source.projectId || !data_source.tableId || !data_source.viewId) {
      return true
    }

    switch (widgetConfig.value.widget_type) {
      case WidgetTypeType.Number: {
        const data_config = widgetConfig.value?.data_config as DataConfigNumber

        return !((data_config.colId && data_config.aggregateFunction) || data_config.recordCountOrFieldSummary === 'record_count')
      }
      case WidgetTypeType.BarChart:
      case WidgetTypeType.LineChart:
      case WidgetTypeType.PieChart: {
        const data_config = widgetConfig.value?.data_config as DataConfigAggregated2DChart
        return (
          !data_config.xAxisColId ||
          !((data_config.yAxisColId && data_config.aggregateFunction) || data_config.recordCountOrFieldSummary === 'record_count')
        )
      }
      //   TODO: Implement this for other widget types as well
      default: {
        return false
      }
    }
  })

  return { dataLinkConfigIsMissing }
}
