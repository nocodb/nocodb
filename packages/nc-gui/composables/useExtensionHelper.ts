import type { ViewType } from 'nocodb-sdk'
import { useInjectionState } from '#imports'

const [useProvideExtensionHelper, useExtensionHelper] = useInjectionState(() => {
  const { $api } = useNuxtApp()

  const basesStore = useBases()

  const { activeProjectId: baseId } = storeToRefs(basesStore)

  const tableStore = useTablesStore()

  const { activeTables: tables } = storeToRefs(tableStore)

  const viewStore = useViewsStore()

  const { viewsByTable } = storeToRefs(viewStore)

  const fullScreen = ref(false)

  const getViewsForTable = async (tableId: string) => {
    if (viewsByTable.value.has(tableId)) {
      return viewsByTable.value.get(tableId) as ViewType[]
    }

    await viewStore.loadViews({ tableId })
    return viewsByTable.value.get(tableId) as ViewType[]
  }

  const getData = async (params: {
    tableId: string
    viewId?: string
    eachPage: (records: Record<string, any>[], nextPage: () => void) => void
    done: () => void
  }) => {
    const { tableId, viewId, eachPage, done } = params

    let page = 0

    const nextPage = async () => {
      const { list: records, pageInfo } = await $api.dbViewRow.list('noco', baseId.value!, tableId, viewId, {
        offset: (page - 1) * 25,
        limit: 25,
      })

      if (pageInfo?.isLastPage) {
        done()
      } else {
        page++
        eachPage(records, nextPage)
      }
    }

    nextPage()
  }

  return {
    fullScreen,
    tables,
    getViewsForTable,
    getData,
  }
}, 'extension-helper')

export { useProvideExtensionHelper }

export function useExtensionHelperOrThrow() {
  const extensionStore = useExtensionHelper()
  if (extensionStore == null) throw new Error('Please call `useProvideExtensionHelper` on the appropriate parent component')
  return extensionStore
}
