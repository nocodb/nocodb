import type { SourceType, BaseType } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'
import { defineStore, storeToRefs } from 'pinia'
import { TabType, computed, navigateTo, ref, useBase, useBases, useRouter, watch } from '#imports'
import type { TabItem } from '#imports'

function getPredicate(key: Partial<TabItem>) {
  // todo: temp
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return (tab: TabItem) => Object.keys(key).every((k) => tab[k] === key[k])
}

export const useTabs = defineStore('tabStore', () => {
  const tabs = ref<TabItem[]>([])

  const router = useRouter()

  const route = router.currentRoute

  const { t } = useI18n()

  const { isUIAllowed } = useRoles()

  const docStore = useDocStore()
  const { nestedUrl, baseUrl: docsProjectUrl } = docStore
  const { openedPageId } = storeToRefs(docStore)

  const basesStore = useBases()

  const baseStore = useBase()
  const { baseUrl } = baseStore
  const { base, tables } = storeToRefs(baseStore)

  const baseType = computed(() => (route.value.params.baseType as string) || 'nc')

  // todo: new-layout
  const workspaceId = computed(() => route.value.params.typeOrId as string)

  // const previousActiveTabIndex = ref(-1)
  const activeTabIndex: WritableComputedRef<number> = computed({
    get() {
      return 0
      const routeName = route.value.name as string

      if (routeName.includes('doc-index-pageId')) {
        return tabs.value.findIndex((tab) => tab.id === openedPageId.value)
      }

      if (routeName === 'ws-workspaceId-baseType-baseId-index-index') {
        return tabs.value.findIndex((tab) => tab.type === TabType.DB && tab.baseId === base.value?.id)
      }

      // todo: new-layout
      if (
        routeName.includes('baseType-baseId-index-index-type-title-viewTitle') &&
        (tables.value?.length || basesStore.baseTableList[base.value?.id || '']?.length)
      ) {
        const tab: TabItem = {
          baseId: route.value.params.baseId as string,
          title: route.value.params.title as string,
        }

        const currentTable = (tables.value ?? basesStore.baseTableList[base.value?.id]).find((t) => {
          return t.id === tab.title || t.title === tab.title
        })

        if (!currentTable) return -1

        const currentBase = baseStore.sources.find((b) => b.id === currentTable.source_id)

        tab.id = currentTable.id

        let index = tabs.value.findIndex((t) => t.id === tab.id)

        tab.title = currentTable.title

        tab.meta = currentTable.meta as Record<string, any>

        // append base alias to tab title if duplicate titles exist on other sources
        if (tables.value.find((t) => t.title === currentTable?.title && t.source_id !== currentTable?.source_id))
          tab.title = `${tab.title}${currentBase?.alias ? ` (${currentBase.alias})` : ``}`

        if (index === -1) {
          tab.sortsState = tab.sortsState || new Map()
          tab.filterState = tab.filterState || new Map()
          tabs.value.push(tab)
          index = tabs.value.length - 1
        }

        return index
      } else if (routeName.includes('baseType-baseId-index-index-auth')) {
        return tabs.value.findIndex((t) => t.type === TabType.AUTH)
      } else if (routeName.includes('baseType-baseId-index-index-sql')) {
        return tabs.value.findIndex((t) => t.id === `${TabType.SQL}-${route.value.params.baseId}`)
      } else if (routeName.includes('baseType-baseId-index-index-erd-sourceId')) {
        return tabs.value.findIndex((t) => t.id === `${TabType.ERD}-${route.value.params.sourceId}`)
      } else if (routeName.includes('baseType-baseId-index-index-doc')) {
        return tabs.value.findIndex((t) => t.id === route.value.params.baseId)
      }

      // by default, it's showing Team & Auth
      return 0
    },
    set(index: number) {
      return
      if (index === -1) {
        navigateTo({
          path: `/${workspaceId.value}/${base.value?.id}`,
          query: route.value.query,
        })
      } else {
        const tab = tabs.value[index]

        if (!tab) return

        if (tab.baseId) {
          basesStore
            .loadProject(tab.baseId)
            .then(() => {
              if (tab.type !== TabType.DOCUMENT) basesStore.loadProjectTables(tab.baseId!)
            })
            .then(() => {
              navigateToTab(tab)
            })
        } else {
          console.error('tab.baseId is not defined')
          navigateToTab(tab)
        }
      }
    },
  })

  // watch(activeTabIndex, (_, old) => {
  //   previousActiveTabIndex.value = old
  // })

  const activeTab = computed(() => ({} as TabItem))

  const addTab = async (tabMeta: TabItem) => {
    return
    if (tabMeta.type === TabType.DOCUMENT) {
      const index = tabs.value.findIndex((tab) => tab.id === tabMeta.id)
      if (index > -1) {
        activeTabIndex.value = index
        return
      }

      tabs.value = [...(tabs.value || []), tabMeta]
      activeTabIndex.value = tabs.value.length - 1
      return
    }

    tabMeta.sortsState = tabMeta.sortsState || new Map()
    tabMeta.filterState = tabMeta.filterState || new Map()
    const tabIndex = tabs.value.findIndex((tab) => tab.id === tabMeta.id)
    // if tab already found make it active
    if (tabIndex > -1) {
      activeTabIndex.value = tabIndex
    }

    // if tab not found add it
    else {
      if (tabMeta.baseId) {
        await basesStore.loadProject(tabMeta.baseId)
        if (tabMeta.type !== TabType.DOCUMENT) {
          await basesStore.loadProjectTables(tabMeta.baseId)
        }
      }
      const currentTable = tables.value.find((t) => t.id === tabMeta.id || t.title === tabMeta.id)
      const currentBase = baseStore.sources.find((b) => b.id === currentTable?.source_id)

      tabMeta.meta = currentTable?.meta

      // append base alias to tab title if duplicate titles exist on other sources
      if (tables.value.find((t) => t.title === currentTable?.title && t.source_id !== currentTable?.source_id))
        tabMeta.title = `${tabMeta.title}${currentBase?.alias ? ` (${currentBase.alias})` : ``}`

      tabs.value = [...(tabs.value || []), tabMeta]
      activeTabIndex.value = tabs.value.length - 1
    }
  }

  const addErdTab = async (source: SourceType, fallback_title?: string) => {
    return addTab({
      id: `${TabType.ERD}-${source?.id}`,
      type: TabType.ERD,
      title: `ERD${source?.alias ? ` (${source.alias})` : `(${fallback_title})`}`,
      tabMeta: { source },
      baseId: source.base_id as string,
    })
  }

  const addSqlEditorTab = async (base: BaseType) => {
    return addTab({
      id: `${TabType.SQL}-${base.id}`,
      type: TabType.SQL,
      title: `SQL Editor (${base.title})`,
      tabMeta: { base },
      baseId: base.id as string,
    })
  }

  const clearTabs = () => {
    tabs.value = []
  }

  const closeTab = async (key: number | Partial<TabItem>) => {
    return
    const index = typeof key === 'number' ? key : tabs.value.findIndex(getPredicate(key))

    if (activeTabIndex.value === index) {
      let newTabIndex = index - 1

      if (newTabIndex < 0 && tabs.value?.length > 1) newTabIndex = index + 1

      if (newTabIndex === -1) {
        await navigateTo({
          path: `/${workspaceId.value}/${route.value.params.baseId}`,
          query: route.value.query,
        })
      } else {
        await navigateToTab(tabs.value?.[newTabIndex])
      }
    }

    tabs.value.splice(index, 1)
  }

  function navigateToTab(tab: TabItem) {
    return 0
    if (!tab.id || !tab.baseId) {
      console.error('tab.id or tab.baseId is not defined:', tab)
      throw new Error('tab.id or tab.baseId is not defined')
    }

    switch (tab.type) {
      case TabType.TABLE:
        return navigateTo({
          path: `/${workspaceId.value}/${tab.baseId}/${tab?.id}${tab.viewTitle ? `/${tab.viewTitle}` : ''}`,
          query: route.value.query,
        })
      case TabType.VIEW:
        return navigateTo({
          path: `/${workspaceId.value}/${tab.baseId}/${tab?.id}${tab.viewTitle ? `/${tab.viewTitle}` : ''}`,
          query: route.value.query,
        })
      case TabType.AUTH:
        return navigateTo({
          path: `/${workspaceId.value}/${tab.baseId}/auth`,
          query: route.value.query,
        })
      case TabType.SQL:
        return navigateTo({
          path: `/${workspaceId.value}/${tab.baseId}/sql`,
          query: route.value.query,
        })
      case TabType.ERD:
        return navigateTo({
          path: `/${workspaceId.value}/${tab.baseId}/erd/${tab?.tabMeta?.source.id}`,
          query: route.value.query,
        })
      case TabType.DOCUMENT:
        if (tab.id === tab.baseId) {
          return navigateTo(docsProjectUrl(tab.baseId!))
        }

        return navigateTo({
          path: nestedUrl({
            baseId: tab.baseId!,
            id: tab.id!,
          }),
          query: route.value.query,
        })
      case TabType.DB:
        return navigateTo(
          baseUrl({
            id: base.value.id!,
            type: 'database',
          }),
        )
    }
  }

  const updateTab = (key: number | Partial<TabItem>, newTabItemProps: Partial<TabItem>) => {
    return
    const tab = typeof key === 'number' ? tabs.value[key] : tabs.value.find(getPredicate(key))

    if (tab) {
      const isActive = tabs.value.indexOf(tab) === activeTabIndex.value

      Object.assign(tab, newTabItemProps)

      if (isActive && tab.id && tab.type !== TabType.DOCUMENT) {
        router.replace({
          params: {
            title: tab.id,
          },
        })
      }
    }
  }

  watch(
    () => route.value.name,
    (n, o) => {
      return
      if (n === o) return
      if (!n || !/baseType-baseId-index-index/.test(n.toString())) return
      const activeTabRoute = n.toString().replace(/ws-workspaceId-baseType-baseId-index-index-/, '')
      switch (activeTabRoute) {
        case TabType.AUTH:
          if (isUIAllowed('teamAndAuth'))
            addTab({
              id: TabType.AUTH,
              type: TabType.AUTH,
              title: t('title.teamAndAuth'),
              baseId: route.value.params.baseId as string,
            })
          break
        default:
          break
      }
    },
    { immediate: true },
  )

  return { tabs, addTab, activeTabIndex, activeTab, clearTabs, closeTab, updateTab, addErdTab, addSqlEditorTab }
})
