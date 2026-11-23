import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'

/**
 * Print for the open grid view. Provided by the smartsheet, so the toolbar's view menu
 * can open the settings and the print host can load the rows with the view's
 * current search, filters, sorts and groups.
 */
const [useProvideViewPrint, useViewPrint] = useInjectionState(
  (meta: Ref<TableType | undefined>, view: Ref<ViewType | undefined>) => {
    const { $api } = useNuxtApp()

    const { isUIAllowed } = useRoles()

    const { base } = storeToRefs(useBase())

    const isSettingsOpen = ref(false)

    const isPreparing = ref(false)

    const printState = ref<{
      rows: Record<string, any>[]
      totalRows: number
      rangeStart: number
      settings: PrintSettings
      groupColumns: ColumnType[]
      summary: PrintSummary
    } | null>(null)

    const storageKey = computed(() => `${base.value?.id ?? ''}:${view.value?.id ?? ''}`)

    function openSettings() {
      isSettingsOpen.value = true
    }

    function fetchRows(query: PrintListQuery, offset: number, limit: number) {
      // The server applies the view's saved filters, sorts and hidden fields.
      const params = buildPrintListParams(query, { sortSync: isUIAllowed('sortSync'), filterSync: isUIAllowed('filterSync') })

      // All-fields search runs only on the internal `dataList` operation; the v1 data API ignores `search`.
      if (params.search) {
        return $api.internal.getOperation(meta.value!.fk_workspace_id!, base.value!.id!, {
          operation: 'dataList',
          tableId: meta.value!.id!,
          viewId: view.value!.id!,
          baseId: base.value!.id!,
          ...params,
          offset,
          limit,
        })
      }

      return $api.dbViewRow.list('noco', base.value!.id!, meta.value!.id!, view.value!.id!, { ...params, offset, limit })
    }

    /** How many records the print can choose from. */
    async function countRecords(query: PrintListQuery) {
      if (!base.value?.id || !meta.value?.id || !view.value?.id) return 0

      const { list, pageInfo } = await fetchRows(query, 0, 1)
      return pageInfo?.totalRows ?? list.length
    }

    async function print(
      settings: PrintSettings,
      range: PrintRange,
      query: PrintListQuery,
      loadSummary: () => Promise<PrintSummary> = async () => ({}),
      // Lets a renderer that draws asynchronously finish before the print dialog opens.
      waitForRender: () => Promise<void> = async () => {},
    ) {
      if (isPreparing.value || !base.value?.id || !meta.value?.id || !view.value?.id) return

      isPreparing.value = true

      try {
        const [{ rows, total }, summary] = await Promise.all([
          loadAllPrintRows(
            (offset, limit) => fetchRows(query, offset, limit),
            Math.min(range.end - range.start + 1, PRINT_RECORD_LIMIT),
            PRINT_FETCH_PAGE_SIZE,
            range.start - 1,
          ),
          // The footer summary is optional; a failed aggregate still prints the records.
          loadSummary().catch(() => ({})),
        ])

        // Listen before the renderer mounts: it can fail during the mount itself.
        const rendered = waitForRender()
        printState.value = {
          rows,
          totalRows: total,
          rangeStart: range.start,
          settings,
          groupColumns: query.groupBy.map((g) => g.column),
          summary,
        }

        isSettingsOpen.value = false

        await nextTick()
        await rendered

        saveLastPrintedEnd(storageKey.value, range.end)
        window.print()
      } catch (e: any) {
        printState.value = null
        message.error(await extractSdkResponseErrorMsg(e))
      } finally {
        isPreparing.value = false
      }
    }

    useEventListener(window, 'afterprint', () => {
      printState.value = null
    })

    return { isSettingsOpen, isPreparing, printState, storageKey, openSettings, countRecords, print }
  },
  'view-print',
)

export { useProvideViewPrint, useViewPrint }
