import type { ChartTypes, ChartWidgetType } from 'nocodb-sdk'
import { getChartColors } from '~/lib/constants'
import { truncateText } from '~/utils/stringUtils'

const SMALL_SLICE_PERCENT = 3
const MAX_SLICES_BEFORE_BUCKETING = 8
const LABEL_MIN_SLICE_PERCENT = 4
const LEGEND_TRUNCATE = 28
// Below this widget width a side legend crowds the chart — slice labels
// at the chart's right edge end up flush with the legend text. Switch
// legend to bottom under this threshold. 600px is empirically the
// lowest width that fits a ~160px legend AND a comfortable chart
// side-by-side without crowding.
const NARROW_WIDGET_PX = 600

function luminance(hex: string): number {
  const c = hex.replace('#', '')
  if (c.length < 6) return 0.5
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255
  const t = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return 0.2126 * t(r) + 0.7152 * t(g) + 0.0722 * t(b)
}

function textColorFor(bg: string): string {
  return luminance(bg) > 0.5 ? '#1f2937' : '#ffffff'
}

function bucketSmallSlices(data: any[]) {
  if (!Array.isArray(data) || data.length <= MAX_SLICES_BEFORE_BUCKETING) return data

  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
  if (total === 0) return data

  const sorted = [...data].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
  const kept: any[] = []
  const collapsed: any[] = []

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]
    const pct = ((Number(item.value) || 0) / total) * 100
    if (i < MAX_SLICES_BEFORE_BUCKETING && pct >= SMALL_SLICE_PERCENT) {
      kept.push(item)
    } else {
      collapsed.push(item)
    }
  }

  if (collapsed.length > 1) {
    const otherValue = collapsed.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
    kept.push({
      name: `Other (${collapsed.length})`,
      value: otherValue,
      _collapsed: collapsed,
    })
  } else if (collapsed.length === 1) {
    kept.push(collapsed[0])
  }

  return kept
}

/**
 * Shared ECharts option builder for Pie and Donut widgets.
 * Both widgets are visually identical apart from the inner radius — extracting this
 * keeps fixes in one place and prevents the donut from drifting behind the pie.
 */
export function useDashboardPieChartOption(
  widgetRef: Ref<ChartWidgetType<ChartTypes.PIE | ChartTypes.DONUT>>,
  widgetData: Ref<any>,
  options: { isDonut?: boolean; widgetWidth?: Ref<number> } = {},
) {
  const isDonut = options.isDonut ?? false
  const widgetWidth = options.widgetWidth ?? ref(0)

  const chartConfig = computed(() => widgetRef.value?.config)

  const isNarrow = computed(() => widgetWidth.value > 0 && widgetWidth.value < NARROW_WIDGET_PX)

  // Resolved legend position: honors the user's config except on narrow
  // widgets, where a side-anchored legend would crash into the chart.
  const effectiveLegendPosition = computed(() => {
    const configured = chartConfig.value?.appearance?.legendPosition ?? 'right'
    if (isNarrow.value && (configured === 'left' || configured === 'right')) {
      return 'bottom'
    }
    return configured
  })

  const paletteColors = computed(() => getChartColors((chartConfig.value?.appearance as any)?.palette))

  const processedData = computed(() => {
    const raw = widgetData.value?.data
    if (!Array.isArray(raw)) return []

    const bucketed = bucketSmallSlices(raw)
    const palette = paletteColors.value

    return bucketed.map((item, i) => {
      const sliceColor = palette[i % palette.length]
      return {
        ...item,
        // Per-slice label color picked from slice background luminance —
        // prevents white-on-yellow / white-on-cyan unreadable labels.
        label: {
          color: textColorFor(sliceColor),
        },
      }
    })
  })

  const legendConfig = computed(() => {
    const position = effectiveLegendPosition.value
    const showCountInLegend = chartConfig.value?.appearance?.showCountInLegend ?? true

    if (position === 'none') {
      return { show: false }
    }

    const positionMap: Record<string, any> = {
      top: { orient: 'horizontal', top: 8, left: 'center' },
      bottom: { orient: 'horizontal', bottom: 8, left: 'center' },
      left: { orient: 'vertical', left: 8, top: 'middle' },
      right: { orient: 'vertical', right: 8, top: 'middle' },
    }

    return {
      show: true,
      type: 'scroll',
      ...positionMap[position],
      formatter: (name: string) => {
        const item = processedData.value?.find((d: any) => d.name === name)
        if (showCountInLegend && item) {
          const displayValue = item.formatted_value !== undefined ? item.formatted_value : item.value
          return `${truncateText(name, LEGEND_TRUNCATE)}: ${displayValue}`
        }
        return truncateText(name, LEGEND_TRUNCATE + 8)
      },
      textStyle: { fontSize: 12, color: '#666' },
      itemGap: 8,
      pageButtonItemGap: 4,
      pageIconSize: 10,
      pageTextStyle: { fontSize: 11 },
      tooltip: {
        show: true,
        formatter: (params: any) => {
          const name = params.name
          if (!showCountInLegend) return name
          const item = processedData.value?.find((d: any) => d.name === name)
          if (!item) return name
          const displayValue = item.formatted_value !== undefined ? item.formatted_value : item.value
          return `${name}: ${displayValue}`
        },
      },
    }
  })

  const chartOption = computed<ECOption>(() => {
    const data = processedData.value
    if (!data || data.length === 0) return {}

    const showPercentageOnChart = chartConfig.value?.appearance?.showPercentageOnChart ?? true
    const position = effectiveLegendPosition.value
    const legendOnSide = position === 'left' || position === 'right'

    const centerByPosition: Record<string, [string, string]> = {
      top: ['50%', '58%'],
      bottom: ['50%', '44%'],
      left: ['62%', '50%'],
      right: ['38%', '50%'],
      none: ['50%', '50%'],
    }
    const center = legendConfig.value.show ? centerByPosition[position] : ['50%', '50%']
    // Shrink the chart when the legend takes a side. ECharts radius is
    // % of min(W, H), so a 55% radius is 110% diameter — easily crowds
    // a side legend. 48% (96% diameter) leaves room around the chart
    // for breathing space against the legend.
    const radius = isDonut
      ? legendOnSide
        ? ['24%', '48%']
        : ['38%', '70%']
      : legendOnSide
        ? '48%'
        : '70%'

    return {
      color: paletteColors.value,
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const item = data.find((d: any) => d.name === params.name)
          if (item?._collapsed) {
            const items = item._collapsed
              .slice(0, 8)
              .map((c: any) => `${c.name}: ${c.value}`)
              .join('<br/>')
            const more = item._collapsed.length > 8 ? `<br/>… ${item._collapsed.length - 8} more` : ''
            return `<strong>Other</strong><br/>${items}${more}`
          }
          if (item) {
            const dv = item.formatted_value !== undefined ? item.formatted_value : item.value
            return `${params.name}<br/>${dv} (${params.percent}%)`
          }
          return `${params.seriesName}<br/>${params.name}: ${params.value} (${params.percent}%)`
        },
        backgroundColor: 'rgba(50, 50, 50, 0.92)',
        textStyle: { color: '#fff', fontSize: 12 },
        borderWidth: 0,
        borderRadius: 6,
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15);',
      },
      legend: legendConfig.value,
      series: [
        {
          name: widgetRef.value?.title || 'Data',
          type: 'pie',
          radius,
          center,
          data,
          minAngle: 2,
          label: {
            show: showPercentageOnChart,
            position: 'inside',
            fontSize: 12,
            fontWeight: 600,
            formatter: (params: any) => {
              if (!showPercentageOnChart) return ''
              if (params.percent < LABEL_MIN_SLICE_PERCENT) return ''
              return `${params.percent.toFixed(0)}%`
            },
          },
          labelLayout: { hideOverlap: true },
          labelLine: { show: false },
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 1,
          },
          emphasis: {
            scale: true,
            scaleSize: 4,
            label: { fontSize: 13, fontWeight: 700 },
          },
        },
      ],
    }
  })

  return {
    chartOption,
    processedData,
  }
}
