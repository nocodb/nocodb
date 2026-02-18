import dayjs from 'dayjs'
import type { ColumnType, TableType, TimelineType, ViewType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { computed, reactive, ref, watch, type ComputedRef, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { Row } from '~/lib/types'

const [useProvideTimelineViewStore, useTimelineViewStore] = useInjectionState(
  (
    meta: Ref<TableType | undefined>,
    viewMeta: Ref<(ViewType | TimelineType | undefined) & { id: string }>,
    shared = false,
    where?: ComputedRef<string | undefined>,
  ) => {
    const { isUIAllowed } = useRoles()

    const { $api } = useNuxtApp()

    const { base } = storeToRefs(useBase())

    const { sharedView } = useSharedView()

    const isPublic = ref(shared)

    // Timeline state
    const zoomLevel = ref<'week' | 'month'>('month')

    const currentDate = ref<dayjs.Dayjs>(dayjs())

    const selectedDate = ref<dayjs.Dayjs>(dayjs())

    const formattedData = ref<Row[]>([])

    const isTimelineDataLoading = ref<boolean>(false)

    const searchQuery = reactive({
      value: '',
      field: '',
    })

    // Timeline meta data
    const timelineMetaData = computed<TimelineType>(() => {
      return isPublic.value ? (sharedView.value?.view as TimelineType) : (viewMeta.value?.view as TimelineType)
    })

    const viewMetaProperties = computed(() => {
      const metaObj = timelineMetaData.value?.meta
      if (typeof metaObj === 'string') {
        try {
          return JSON.parse(metaObj)
        } catch {
          return {}
        }
      }
      return metaObj ?? {}
    })

    // Timeline range - maps to start/end date columns
    const timelineRange = computed<
      Array<{
        fk_from_col: ColumnType
        fk_to_col?: ColumnType | null
        id: string
        is_readonly: boolean
      }>
    >(() => {
      if (!timelineMetaData.value?.timeline_range?.length) return []

      return timelineMetaData.value.timeline_range
        .map((range: any) => {
          // Get the from column
          const fromCol = (meta.value?.columns ?? []).find(
            (col) => col.id === range.fk_from_column_id,
          )
          // Get the to column (optional)
          const toCol = range.fk_to_column_id
            ? (meta.value?.columns ?? []).find(
                (col) => col.id === range.fk_to_column_id,
              )
            : null

          if (!fromCol) return null

          return {
            fk_from_col: fromCol,
            fk_to_col: toCol,
            id: `${range.fk_from_column_id}_${range.fk_to_column_id}`,
            is_readonly: ![UITypes.Date, UITypes.DateTime].includes(fromCol.uidt as UITypes),
          }
        })
        .filter(Boolean)
    })

    // Compute visible dates based on zoom level
    const visibleDates = computed<dayjs.Dayjs[]>(() => {
      const dates: dayjs.Dayjs[] = []
      if (zoomLevel.value === 'month') {
        const startOfMonth = currentDate.value.startOf('month')
        const daysInMonth = currentDate.value.daysInMonth()
        for (let i = 0; i < daysInMonth; i++) {
          dates.push(startOfMonth.add(i, 'day'))
        }
      } else {
        // week view
        const startOfWeek = currentDate.value.startOf('week')
        for (let i = 0; i < 7; i++) {
          dates.push(startOfWeek.add(i, 'day'))
        }
      }
      return dates
    })

    const dateRangeLabel = computed(() => {
      if (zoomLevel.value === 'month') {
        return currentDate.value.format('MMMM YYYY')
      } else {
        const start = currentDate.value.startOf('week')
        const end = currentDate.value.endOf('week')
        if (start.month() === end.month()) {
          return `${start.format('D')} - ${end.format('D MMM YYYY')}`
        }
        return `${start.format('D MMM')} - ${end.format('D MMM YYYY')}`
      }
    })

    // Data loading
    const loadTimelineData = async () => {
      if (
        ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) ||
        !timelineRange.value?.length
      )
        return

      isTimelineDataLoading.value = true

      try {
        const res = !isPublic.value
          ? await $api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id as string, {
              where: where?.value ?? '',
              limit: 400,
            })
          : await $api.dbViewRow.list('noco', base.value?.id as string, meta.value?.id as string, viewMeta.value?.id as string, {
              where: where?.value ?? '',
              limit: 400,
            })

        formattedData.value = (res?.list ?? []).map((row: any) => ({
          row,
          rowMeta: {
            range: timelineRange.value[0],
          },
          oldRow: { ...row },
        }))
      } catch (e) {
        console.error('Error loading timeline data:', e)
      } finally {
        isTimelineDataLoading.value = false
      }
    }

    // Navigation
    const navigateNext = () => {
      if (zoomLevel.value === 'month') {
        currentDate.value = currentDate.value.add(1, 'month')
      } else {
        currentDate.value = currentDate.value.add(1, 'week')
      }
    }

    const navigatePrev = () => {
      if (zoomLevel.value === 'month') {
        currentDate.value = currentDate.value.subtract(1, 'month')
      } else {
        currentDate.value = currentDate.value.subtract(1, 'week')
      }
    }

    const goToToday = () => {
      currentDate.value = dayjs()
      selectedDate.value = dayjs()
    }

    const setZoomLevel = (level: 'week' | 'month') => {
      zoomLevel.value = level
    }

    return {
      // State
      zoomLevel,
      currentDate,
      selectedDate,
      formattedData,
      isTimelineDataLoading,
      searchQuery,
      timelineMetaData,
      viewMetaProperties,
      timelineRange,
      visibleDates,
      dateRangeLabel,
      isPublic,

      // Methods
      loadTimelineData,
      navigateNext,
      navigatePrev,
      goToToday,
      setZoomLevel,
    }
  },
  'timeline-view-store',
)

export { useProvideTimelineViewStore }

export function useTimelineViewStoreOrThrow() {
  const store = useTimelineViewStore()
  if (!store) {
    throw new Error('Timeline view store is not provided')
  }
  return store
}
