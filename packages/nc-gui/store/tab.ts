import type { WritableComputedRef } from '@vue/reactivity'
import { defineStore } from 'pinia'
import { computed, navigateTo, ref, useProject, useRouter, watch } from '#imports'
import type { TabItem } from '~/lib'
import { TabType } from '~/lib'

function getPredicate(key: Partial<TabItem>) {
  return (tab: TabItem) =>
    (!('id' in key) || tab.id === key.id) &&
    (!('title' in key) || tab.title === key.title) &&
    (!('type' in key) || tab.type === key.type)
}

export const useTabs = defineStore('tabStore', () => {
  const tabs = ref<TabItem[]>([])

  const router = useRouter()

  const route = $(router.currentRoute)

  const { t } = useI18n()

  const { isUIAllowed } = useUIPermission()

  const projectStore = useProject()

  const projectType = $computed(() => route.params.projectType as string)

  const previousActiveTabIndex = ref(-1)
  const activeTabIndex: WritableComputedRef<number> = computed({
    get() {
      const routeName = route.name as string

      if (routeName.startsWith('projectType-projectId-index-index-type-title-viewTitle') && projectStore.tables.length) {
        const tab: TabItem = { type: route.params.type as TabType, title: route.params.title as string }

        const currentTable = projectStore.tables.find((t) => t.id === tab.title || t.title === tab.title)

        if (!currentTable) return -1

        const currentBase = projectStore.bases.find((b) => b.id === currentTable.base_id)

        tab.id = currentTable.id

        let index = tabs.value.findIndex((t) => t.id === tab.id)

        tab.title = currentTable.title

        tab.meta = currentTable.meta

        // append base alias to tab title if duplicate titles exist on other bases
        if (projectStore.tables.find((t) => t.title === currentTable?.title && t.base_id !== currentTable?.base_id))
          tab.title = `${tab.title}${currentBase?.alias ? ` (${currentBase.alias})` : ``}`

        if (index === -1) {
          tab.sortsState = tab.sortsState || new Map()
          tab.filterState = tab.filterState || new Map()
          tabs.value.push(tab)
          index = tabs.value.length - 1
        }

        return index
      } else if (routeName.startsWith('projectType-projectId-index-index-auth')) {
        return tabs.value.findIndex((t) => t.type === TabType.AUTH)
      } else if (routeName.startsWith('projectType-projectId-index-index-sql')) {
        return tabs.value.findIndex((t) => t.type === TabType.SQL)
      } else if (routeName.startsWith('projectType-projectId-index-index-erd-baseId')) {
        return tabs.value.findIndex((t) => t.id === `${TabType.ERD}-${route.params.baseId}`)
      }

      // by default, it's showing Team & Auth
      return 0
    },
    set(index: number) {
      if (index === -1) {
        navigateTo(`/${projectType}/${route.params.projectId}`)
      } else {
        const tab = tabs.value[index]

        if (!tab) return

        navigateToTab(tab)
      }
    },
  })

  watch(activeTabIndex, (_, old) => {
    previousActiveTabIndex.value = old
  })

  const activeTab = computed(() => tabs.value?.[activeTabIndex.value])

  const addTab = (tabMeta: TabItem) => {
    tabMeta.sortsState = tabMeta.sortsState || new Map()
    tabMeta.filterState = tabMeta.filterState || new Map()
    const tabIndex = tabs.value.findIndex((tab) => tab.id === tabMeta.id)
    // if tab already found make it active
    if (tabIndex > -1) {
      activeTabIndex.value = tabIndex
    }
    // if tab not found add it
    else {
      const currentTable = projectStore.tables.find((t) => t.id === tabMeta.id || t.title === tabMeta.id)
      const currentBase = projectStore.bases.find((b) => b.id === currentTable?.base_id)

      tabMeta.meta = currentTable?.meta

      // append base alias to tab title if duplicate titles exist on other bases
      if (projectStore.tables.find((t) => t.title === currentTable?.title && t.base_id !== currentTable?.base_id))
        tabMeta.title = `${tabMeta.title}${currentBase?.alias ? ` (${currentBase.alias})` : ``}`

      tabs.value = [...(tabs.value || []), tabMeta]
      activeTabIndex.value = tabs.value.length - 1
    }
  }

  const clearTabs = () => {
    tabs.value = []
  }

  const closeTab = async (key: number | Partial<TabItem>) => {
    const index = typeof key === 'number' ? key : tabs.value.findIndex(getPredicate(key))

    if (activeTabIndex.value === index) {
      let newTabIndex = index - 1

      if (newTabIndex < 0 && tabs.value?.length > 1) newTabIndex = index + 1

      if (newTabIndex === -1) {
        await navigateTo(`/${projectType}/${route.params.projectId}`)
      } else {
        await navigateToTab(tabs.value?.[newTabIndex])
      }
    }

    tabs.value.splice(index, 1)
  }

  function navigateToTab(tab: TabItem) {
    switch (tab.type) {
      case TabType.TABLE:
        return navigateTo(`/${projectType}/${route.params.projectId}/table/${tab?.id}${tab.viewTitle ? `/${tab.viewTitle}` : ''}`)
      case TabType.VIEW:
        return navigateTo(`/${projectType}/${route.params.projectId}/view/${tab?.id}${tab.viewTitle ? `/${tab.viewTitle}` : ''}`)
      case TabType.AUTH:
        return navigateTo(`/${projectType}/${route.params.projectId}/auth`)
      case TabType.SQL:
        return navigateTo(`/${projectType}/${route.params.projectId}/sql`)
      case TabType.ERD:
        return navigateTo(`/${projectType}/${route.params.projectId}/erd/${tab?.tabMeta?.base.id}`)
    }
  }

  const updateTab = (key: number | Partial<TabItem>, newTabItemProps: Partial<TabItem>) => {
    const tab = typeof key === 'number' ? tabs.value[key] : tabs.value.find(getPredicate(key))

    if (tab) {
      const isActive = tabs.value.indexOf(tab) === previousActiveTabIndex.value

      Object.assign(tab, newTabItemProps)

      if (isActive && tab.id)
        router.replace({
          params: {
            title: tab.id,
          },
        })
    }
  }

  watch(
    () => route.name,
    (n, o) => {
      if (n === o) return
      if (!n || !/^projectType-projectId-index-index/.test(n.toString())) return
      const activeTabRoute = n.toString().replace('projectType-projectId-index-index-', '')
      switch (activeTabRoute) {
        case TabType.SQL:
          addTab({ id: TabType.SQL, type: TabType.SQL, title: 'SQL Editor' })
          break
        case TabType.AUTH:
          if (isUIAllowed('teamAndAuth')) addTab({ id: TabType.AUTH, type: TabType.AUTH, title: t('title.teamAndAuth') })
          break
        default:
          break
      }
    },
    { immediate: true },
  )

  return { tabs, addTab, activeTabIndex, activeTab, clearTabs, closeTab, updateTab }
})
