import type { ComputedRef, Ref } from 'vue'
import type { ColumnType, CalendarType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import { IsPublicInj, ref, storeToRefs, useBase, useInjectionState, useMetas } from '#imports'
import type { Row } from '#imports'
import {addDays, addMonths, addWeeks, addYears} from "../utils";

const formatData = (list: Record<string, any>[]) =>
    list.map(
        (row) =>
            ({
                row: { ...row },
                oldRow: { ...row },
                rowMeta: {},
            } as Row),
    )

const [useProvideCalendarViewStore, useCalendarViewStore] = useInjectionState(
    (
        meta: Ref<(CalendarType & { id: string }) | undefined>,
        viewMeta: Ref<(ViewType | CalendarType | undefined) & { id: string }> | ComputedRef<(ViewType & { id: string }) | undefined>,
        shared = false,
        where?: ComputedRef<string | undefined>,
    ) => {
        if (!meta) {
            throw new Error('Table meta is not available')
        }

        const pageDate = ref<Date> (new Date())

        const activeCalendarView = ref<'month' | 'year' | 'day' | 'week'>('month')

        const selectedDate = ref<Date>(new Date())
        const selectedDateRange = ref<{
            start: Date | null
            end: Date | null
        }>({start: null, end: null})

        const defaultPageSize = 1000

        const formattedData = ref<Row[]>([])

        const { api } = useApi()

        const { base } = storeToRefs(useBase())

        const { $api } = useNuxtApp()

        const { isUIAllowed } = useRoles()

        const isPublic = ref(shared) || inject(IsPublicInj, ref(false))

        const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

        const { sharedView, fetchSharedViewData } = useSharedView()

        const calendarMetaData = ref<CalendarType>({})

        // Not Required in Calendar View TODO: Remove
        // const geoDataFieldColumn = ref<ColumnType | undefined>()

        const paginationData = ref<PaginatedType>({ page: 1, pageSize: defaultPageSize })

        const queryParams = computed(() => ({
            limit: paginationData.value.pageSize ?? defaultPageSize,
            where: where?.value ?? '',
        }))

        const changeCalendarView = (view: 'month' | 'year' | 'day' | 'week') => {
            activeCalendarView.value = view
        }

        async function loadCalendarMeta() {
            if (!viewMeta?.value?.id || !meta?.value?.columns) return
            // TODO: Fetch Calendar Meta
            // calendarMetaData.value = isPublic.value ? (sharedView.value?.view as CalendarType) : await $api.dbView.calendarRead(viewMeta.value.id)
            calendarMetaData.value = isPublic.value ? (sharedView.value?.view as CalendarType) : await $api.dbView.mapRead(viewMeta.value.id)

            /*geoDataFieldColumn.value =
                (meta.value.columns as ColumnType[]).filter((f) => f.id === mapMetaData.value.fk_geo_data_col_id)[0] || {}
      */  }

        async function loadCalendarData() {
            if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic?.value) return

            const res = !isPublic.value
                ? await api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id!, {
                    ...queryParams.value,
                    ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
                    where: where?.value,
                })
                : await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: nestedFilters.value })
            formattedData.value = formatData(res!.list)
        }

        async function updateCalendarMeta(updateObj: Partial<CalendarType>) {
            if (!viewMeta?.value?.id || !isUIAllowed('dataEdit')) return
            // await $api.dbView.calendarUpdate(viewMeta.value.id, updateObj)
            await $api.dbView.mapUpdate(viewMeta.value.id, updateObj)
        }

        const paginateCalendarView = (action: 'next' | 'prev') => {
            switch (activeCalendarView.value) {
                case 'month':
                    selectedDate.value = action === 'next' ? addMonths(selectedDate.value, 1) : addMonths(selectedDate.value, -1)
                    break
                case 'year':
                    selectedDate.value = action === 'next' ? addYears(selectedDate.value, 1) : addYears(selectedDate.value, -1)
                    break
                case 'day':
                    selectedDate.value = action === 'next' ? addDays(selectedDate.value, 1) : addDays(selectedDate.value, -1)
                    break
                case 'week':
                    selectedDateRange.value = action === 'next' ? {
                        start: addDays(selectedDateRange.value.start!, 7),
                        end: addDays(selectedDateRange.value.end!, 7)
                    } : {
                        start: addDays(selectedDateRange.value.start!, -7),
                        end: addDays(selectedDateRange.value.end!, -7)
                    }
                    break
            }
        }

        return {
            formattedData,
            changeCalendarView,
            loadCalendarMeta,
            updateCalendarMeta,
            calendarMetaData,
            activeCalendarView,
            pageDate,
            paginationData,
            selectedDate,
            selectedDateRange,
            paginateCalendarView,
        }
    },
)

export { useProvideCalendarViewStore }

export function useCalendarViewStoreOrThrow() {
    const calendarViewStore = useCalendarViewStore()

    if (calendarViewStore == null) throw new Error('Please call `useProvideCalendarViewStore` on the appropriate parent component')

    return calendarViewStore
}
