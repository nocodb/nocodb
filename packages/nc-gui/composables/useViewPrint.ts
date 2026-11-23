import type { ColumnType, FilterType, SortType, TableType, ViewType } from 'nocodb-sdk'

export const VIEW_PRINT_RECORD_LIMIT = 2000

const VIEW_PRINT_PAGE_SIZE = 200

/**
 * Print for the open grid view. Provided by the smartsheet, so the toolbar's view menu
 * can open the settings and the print host can load the rows with the view's
 * current search, filters, sorts and groups.
 */
const [useProvideViewPrint, useViewPrint] = useInjectionState(
  (meta: Ref<TableType | undefined>, view: Ref<ViewType | undefined>) => {
    const { $api } = useNuxtApp()

    const { t } = useI18n()

    const { isUIAllowed } = useRoles()

    const { base } = storeToRefs(useBase())

    const isSettingsOpen = ref(false)

    const isPreparing = ref(false)

    const printState = ref<{
      rows: Record<string, any>[]
      totalRows: number
      settings: PrintSettings
      groupColumns: ColumnType[]
    } | null>(null)

    const storageKey = computed(() => `${base.value?.id ?? ''}:${view.value?.id ?? ''}`)

    function openSettings() {
      isSettingsOpen.value = true
    }

    async function print(
      settings: PrintSettings,
      {
        sorts,
        nestedFilters,
        where,
        groupBy,
      }: {
        sorts: SortType[]
        nestedFilters: FilterType[]
        where?: string
        groupBy: { column: ColumnType; sort: string }[]
      },
    ) {
      if (isPreparing.value || !base.value?.id || !meta.value?.id || !view.value?.id) return

      isPreparing.value = true
      isSettingsOpen.value = false

      message.toast(t('msg.info.interfacePrintPreparing'))

      try {
        // Mirrors the grid's own fetch; the server applies the view's saved filters, sorts and hidden fields.
        // An explicit sort list replaces the view's saved one, so grouped prints send the group fields first, then every sort.
        const sortArr = groupBy.length
          ? [...groupBy.map((g) => ({ fk_column_id: g.column.id, direction: g.sort })), ...sorts]
          : isUIAllowed('sortSync')
          ? null
          : sorts.filter((s) => !s.id)

        const params = {
          ...(sortArr ? { sortArrJson: stringifyFilterOrSortArr(sortArr) } : {}),
          ...(isUIAllowed('filterSync') ? {} : { filterArrJson: stringifyFilterOrSortArr(nestedFilters.filter((f) => !f.id)) }),
          ...(where ? { where } : {}),
        }

        const { rows, total } = await loadAllPrintRows(
          (offset, limit) =>
            $api.dbViewRow.list('noco', base.value!.id!, meta.value!.id!, view.value!.id!, {
              ...params,
              offset,
              limit,
            } as any) as Promise<PrintRowsPage>,
          VIEW_PRINT_RECORD_LIMIT,
          VIEW_PRINT_PAGE_SIZE,
        )

        printState.value = { rows, totalRows: total, settings, groupColumns: groupBy.map((g) => g.column) }

        await nextTick()

        window.print()
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      } finally {
        isPreparing.value = false
      }
    }

    useEventListener(window, 'afterprint', () => {
      printState.value = null
    })

    return { isSettingsOpen, isPreparing, printState, storageKey, openSettings, print }
  },
  'view-print',
)

export { useProvideViewPrint, useViewPrint }
