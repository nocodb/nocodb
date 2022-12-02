import type { WritableComputedRef } from '@vue/reactivity'
import { computed, navigateTo, ref, useInjectionState, useProject, useRoute, useRouter, watch } from '#imports'
import type { TabItem } from '~/lib'
import { TabType } from '~/lib'

function getPredicate(key: Partial<TabItem>) {
  return (tab: TabItem) =>
    (!('id' in key) || tab.id === key.id) &&
    (!('title' in key) || tab.title === key.title) &&
    (!('type' in key) || tab.type === key.type)
}

const [setup, use] = useInjectionState(() => {
  const tabs = ref<TabItem[]>([])

  const route = useRoute()

  const router = useRouter()

  const { tables } = useProject()

  const projectType = $computed(() => route.params.projectType as string)

  const previousActiveTabIndex = ref(-1)
  const activeTabIndex: WritableComputedRef<number> = computed({
    get() {
      const routeName = route.name as string

      if (routeName.startsWith('projectType-projectId-index-index-type-title-viewTitle') && tables.value.length) {
        const tab: TabItem = { type: route.params.type as TabType, title: route.params.title as string }

        const currentTable = tables.value.find((t) => t.title === tab.title)

        if (!currentTable) return -1

        tab.id = currentTable.id

        let index = tabs.value.findIndex((t) => t.id === tab.id)

        if (index === -1) {
          tab.sortsState = tab.sortsState || new Map()
          tab.filterState = tab.filterState || new Map()
          tabs.value.push(tab)
          index = tabs.value.length - 1
        }

        return index
      } else if (routeName.startsWith('nc-projectId-index-index-auth')) {
        return tabs.value.findIndex((t) => t.type === 'auth')
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
        return navigateTo(
          `/${projectType}/${route.params.projectId}/table/${tab?.title}${tab.viewTitle ? `/${tab.viewTitle}` : ''}`,
        )
      case TabType.VIEW:
        return navigateTo(
          `/${projectType}/${route.params.projectId}/view/${tab?.title}${tab.viewTitle ? `/${tab.viewTitle}` : ''}`,
        )
      case TabType.AUTH:
        return navigateTo(`/${projectType}/${route.params.projectId}/auth`)
    }
  }

  const updateTab = (key: number | Partial<TabItem>, newTabItemProps: Partial<TabItem>) => {
    const tab = typeof key === 'number' ? tabs.value[key] : tabs.value.find(getPredicate(key))

    if (tab) {
      const isActive = tabs.value.indexOf(tab) === previousActiveTabIndex.value

      Object.assign(tab, newTabItemProps)

      if (isActive && tab.title)
        router.replace({
          params: {
            title: tab.title,
          },
        })
    }
  }

  return { tabs, addTab, activeTabIndex, activeTab, clearTabs, closeTab, updateTab }
})

export function useTabs() {
  const state = use()

  if (!state) {
    return setup()
  }

  return state
}
