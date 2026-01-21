import { type ViewType } from 'nocodb-sdk'
import type { ExtensionManifest, ExtensionType } from '#imports'

const [useProvideExtensionHelper, useExtensionHelper] = useInjectionState(
  (
    extension: Ref<ExtensionType>,
    extensionManifest: ComputedRef<ExtensionManifest | undefined>,
    activeError: Ref<any>,
    hasAccessToExtension: ComputedRef<boolean>,
  ) => {
    const { $api, $e } = useNuxtApp()
    const route = useRoute()

    const { activeWorkspaceId } = storeToRefs(useWorkspace())

    const basesStore = useBases()

    const { activeProjectId: baseId } = storeToRefs(basesStore)

    const tableStore = useTablesStore()

    const { activeTables: tables } = storeToRefs(tableStore)

    const viewStore = useViewsStore()

    const { viewsByTable } = storeToRefs(viewStore)

    const { getMeta } = useMetas()

    const { eventBus } = useSmartsheetStoreOrThrow()

    const fullscreen = ref(false)

    const showExpandBtn = ref(true)

    const fullscreenModalSize = ref<keyof typeof modalSizes>(extensionManifest.value?.config?.modalSize || 'lg')

    const disableToggleFullscreenBtn = ref(false)

    const activeTableId = computed(() => route.params.viewId as string | undefined)
    const activeViewId = computed(() => route.params.viewTitle as string | undefined)

    const collapsed = computed({
      get: () => extension.value?.meta?.collapsed ?? false,
      set: (value) => {
        extension.value?.setMeta('collapsed', value)
      },
    })

    const getViewsForTable = async (tableId: string) => {
      // Find the table to get its base_id
      const table = tables.value.find((t) => t.id === tableId)
      if (!table?.base_id) {
        console.warn('Could not find base_id for table:', tableId)
        return []
      }

      const key = `${table.base_id}:${tableId}`
      if (viewsByTable.value.has(key)) {
        return viewsByTable.value.get(key) as ViewType[]
      }

      await viewStore.loadViews({ tableId, baseId: table.base_id, ignoreLoading: true })
      return viewsByTable.value.get(key) as ViewType[]
    }

    const getData = async (params: {
      tableId: string
      viewId?: string
      where?: string
      eachPage: (records: Record<string, any>[], nextPage: () => void) => Promise<void> | void
      done: () => Promise<void> | void
    }) => {
      const { tableId, viewId, where, eachPage, done } = params

      let page = 1

      const nextPage = async () => {
        const { list: records, pageInfo } = await $api.dbViewRow.list(
          'noco',
          baseId.value!,
          tableId,
          viewId as string,
          {
            offset: (page - 1) * 100,
            limit: 100,
            where,
          } as any,
        )

        if (pageInfo?.isLastPage) {
          await eachPage(records, () => {})
          await done()
        } else {
          page++
          await eachPage(records, nextPage)
        }
      }

      await nextPage()
    }

    const getTableMeta = async (tableId: string) => {
      return getMeta(baseId.value!, tableId)
    }

    const insertData = async (params: { tableId: string; data: Record<string, any>[]; autoInsertOption?: boolean }) => {
      const { tableId, data } = params

      const chunks = []

      let inserted = 0

      // chunk data into 100 records
      for (let i = 0; i < data.length; i += 100) {
        chunks.push(data.slice(i, i + 100))
      }

      for (const chunk of chunks) {
        inserted += chunk.length
        await $api.internal.postOperation(
          activeWorkspaceId.value!,
          baseId.value!,
          {
            operation: 'dataInsert',
            tableId,
            ...(params.autoInsertOption ? { typecast: 'true' } : {}),
          },
          chunk,
        )
      }

      return {
        inserted,
      }
    }

    const updateData = async (params: { tableId: string; data: Record<string, any>[] }) => {
      const { tableId, data } = params

      const chunks = []

      let updated = 0

      // chunk data into 100 records
      for (let i = 0; i < data.length; i += 100) {
        chunks.push(data.slice(i, i + 100))
      }

      for (const chunk of chunks) {
        updated += chunk.length
        await $api.internal.postOperation(
          activeWorkspaceId.value!,
          baseId.value!,
          {
            operation: 'dataUpdate',
            tableId,
          },
          chunk,
        )
      }

      return {
        updated,
      }
    }

    const upsertData = async (params: {
      tableId: string
      autoInsertOption?: boolean
      insert: Record<string, any>[]
      update: Record<string, any>[]
    }) => {
      const { tableId, insert, update } = params

      const chunkSize = 100

      const tableMeta = await getMeta(baseId.value!, tableId)

      if (!tableMeta?.columns) throw new Error('Table not found')

      let insertCounter = 0
      let updateCounter = 0

      if (insert.length) {
        insertCounter += insert.length
        while (insert.length) {
          await $api.internal.postOperation(
            activeWorkspaceId.value!,
            baseId.value!,
            {
              operation: 'dataInsert',
              tableId,
              ...(params.autoInsertOption ? { typecast: 'true' } : {}),
            },
            insert.splice(0, chunkSize),
          )
        }
      }

      if (update.length) {
        updateCounter += update.length
        while (update.length) {
          await $api.internal.postOperation(
            activeWorkspaceId.value!,
            baseId.value!,
            {
              operation: 'dataUpdate',
              tableId,
              ...(params.autoInsertOption ? { typecast: 'true' } : {}),
            },
            update.splice(0, chunkSize),
          )
        }
      }

      return { inserted: insertCounter, updated: updateCounter }
    }

    const reloadData = () => {
      eventBus.emit(SmartsheetStoreEvents.DATA_RELOAD)
    }

    const reloadMeta = () => {
      eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    }

    const toggleFullScreen = () => {
      fullscreen.value = !fullscreen.value
      $e(`c:extensions:${extension.value.extensionId}:full-screen`)
    }

    return {
      $api,
      fullscreen,
      collapsed,
      extension,
      extensionManifest,
      activeError,
      tables,
      showExpandBtn,
      fullscreenModalSize,
      activeWorkspaceId,
      activeBaseId: baseId,
      activeTableId,
      activeViewId,
      getViewsForTable,
      getData,
      getTableMeta,
      insertData,
      updateData,
      upsertData,
      reloadData,
      reloadMeta,
      eventBus,
      hasAccessToExtension,
      disableToggleFullscreenBtn,
      toggleFullScreen,
    }
  },
  'extension-helper',
)

export { useProvideExtensionHelper }

export function useExtensionHelperOrThrow() {
  const extensionStore = useExtensionHelper()
  if (extensionStore == null) throw new Error('Please call `useProvideExtensionHelper` on the appropriate parent component')
  return extensionStore
}
