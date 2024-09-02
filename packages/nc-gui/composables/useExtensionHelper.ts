import type { ColumnType, ViewType } from 'nocodb-sdk'
import type { ExtensionManifest, ExtensionType } from '#imports'

const [useProvideExtensionHelper, useExtensionHelper] = useInjectionState(
  (extension: Ref<ExtensionType>, extensionManifest: ComputedRef<ExtensionManifest | undefined>, activeError: Ref<any>) => {
    const { $api } = useNuxtApp()

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

    const collapsed = computed({
      get: () => extension.value?.meta?.collapsed ?? false,
      set: (value) => {
        extension.value?.setMeta('collapsed', value)
      },
    })

    const getViewsForTable = async (tableId: string) => {
      if (viewsByTable.value.has(tableId)) {
        return viewsByTable.value.get(tableId) as ViewType[]
      }

      await viewStore.loadViews({ tableId, ignoreLoading: true })
      return viewsByTable.value.get(tableId) as ViewType[]
    }

    const getData = async (params: {
      tableId: string
      viewId?: string
      eachPage: (records: Record<string, any>[], nextPage: () => void) => Promise<void> | void
      done: () => Promise<void> | void
    }) => {
      const { tableId, viewId, eachPage, done } = params

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
      return getMeta(tableId)
    }

    const insertData = async (params: { tableId: string; data: Record<string, any> }) => {
      const { tableId, data } = params

      const chunks = []

      let inserted = 0

      // chunk data into 100 records
      for (let i = 0; i < data.length; i += 100) {
        chunks.push(data.slice(i, i + 100))
      }

      for (const chunk of chunks) {
        inserted += chunk.length
        await $api.dbDataTableRow.create(tableId, chunk)
      }

      return {
        inserted,
      }
    }

    const updateData = async (params: { tableId: string; data: Record<string, any> }) => {
      const { tableId, data } = params

      const chunks = []

      let updated = 0

      // chunk data into 100 records
      for (let i = 0; i < data.length; i += 100) {
        chunks.push(data.slice(i, i + 100))
      }

      for (const chunk of chunks) {
        updated += chunk.length
        await $api.dbDataTableRow.update(tableId, chunk)
      }

      return {
        updated,
      }
    }

    const upsertData = async (params: {
      tableId: string
      data: Record<string, any>
      upsertField: ColumnType
      importType: 'insert' | 'update' | 'insertAndUpdate'
    }) => {
      const { tableId, data, upsertField } = params

      const chunkSize = 100

      const tableMeta = await getMeta(tableId)

      if (!tableMeta?.columns) throw new Error('Table not found')

      const chunks = []

      for (let i = 0; i < data.length; i += chunkSize) {
        chunks.push(data.slice(i, i + chunkSize))
      }

      const insert = []
      const update = []

      let insertCounter = 0
      let updateCounter = 0

      for (const chunk of chunks) {
        // select chunk of data to determine if it's an insert or update
        const { list } = await $api.dbDataTableRow.list(tableId, {
          where: `(${upsertField.title},in,${chunk.map((record: Record<string, any>) => record[upsertField.title!]).join(',')})`,
          limit: chunkSize,
        })

        if (params.importType !== 'update') {
          insert.push(
            ...chunk.filter(
              (record: Record<string, any>) =>
                !list.some((r: Record<string, any>) => `${r[upsertField.title!]}` === `${record[upsertField.title!]}`),
            ),
          )
        }

        if (params.importType !== 'insert') {
          update.push(
            ...chunk
              .filter((record: Record<string, any>) =>
                list.some((r: Record<string, any>) => `${r[upsertField.title!]}` === `${record[upsertField.title!]}`),
              )
              .map((record: Record<string, any>) => {
                const existingRecord = list.find(
                  (r: Record<string, any>) => `${r[upsertField.title!]}` === `${record[upsertField.title!]}`,
                )
                return {
                  ...rowPkData(existingRecord!, tableMeta.columns!),
                  ...record,
                }
              }),
          )
        }
      }

      if (insert.length) {
        insertCounter += insert.length
        while (insert.length) {
          await $api.dbDataTableRow.create(tableId, insert.splice(0, chunkSize))
        }
      }

      if (update.length) {
        updateCounter += update.length
        while (update.length) {
          await $api.dbDataTableRow.update(tableId, update.splice(0, chunkSize))
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

    return {
      $api,
      fullscreen,
      collapsed,
      extension,
      extensionManifest,
      activeError,
      tables,
      showExpandBtn,
      getViewsForTable,
      getData,
      getTableMeta,
      insertData,
      updateData,
      upsertData,
      reloadData,
      reloadMeta,
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
