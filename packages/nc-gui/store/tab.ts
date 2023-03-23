import type { WritableComputedRef } from '@vue/reactivity'
import { defineStore, storeToRefs } from 'pinia'
import { computed, navigateTo, ref, useProject, useProjects, useRouter, watch } from '#imports'
import type { TabItem } from '~/lib'
import { TabType } from '~/lib'

function getPredicate(key: Partial<TabItem>) {
  // todo: temp
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return (tab: TabItem) => Object.keys(key).every((k) => tab[k] === key[k])
}

export const useTabs = defineStore('tabStore', () => {
  const tabs = ref<TabItem[]>([])

  const router = useRouter()

  const route = $(router.currentRoute)

  const { t } = useI18n()

  const { isUIAllowed } = useUIPermission()

  const { openedPageId } = storeToRefs(useDocStore())
  const { nestedUrl } = useDocStore()

  const projectsStore = useProjects()

  const projectStore = useProject()
  const { project, tables } = $(storeToRefs(projectStore))

  const projectType = $computed(() => (route.params.projectType as string) || 'nc')

  // todo: new-layout
  const workspaceId = $computed(() => route.params.workspaceId as string)

  const previousActiveTabIndex = ref(-1)
  const activeTabIndex: WritableComputedRef<number> = computed({
    get() {
      const routeName = route.name as string

      if (routeName.includes('doc-index-pageId')) {
        return tabs.value.findIndex((tab) => tab.id === openedPageId.value)
      }

      // todo: new-layout
      if (
        routeName.includes('projectType-projectId-index-index-type-title-viewTitle') &&
        (tables?.length || projectsStore.projectTableList[project?.id || '']?.length)
      ) {
        const tab: TabItem = {
          projectId: route.params.projectId as string,
          type: route.params.type as TabType,
          title: route.params.title as string,
        }

        const currentTable = (tables ?? projectsStore.projectTableList[project?.id!]).find((t) => {
          return t.id === tab.title || t.title === tab.title
        })

        if (!currentTable) return -1

        const currentBase = projectStore.bases.find((b) => b.id === currentTable.base_id)

        tab.id = currentTable.id

        let index = tabs.value.findIndex((t) => t.id === tab.id)

        tab.title = currentTable.title

        tab.meta = currentTable.meta as Record<string, any>

        // append base alias to tab title if duplicate titles exist on other bases
        if (tables.find((t) => t.title === currentTable?.title && t.base_id !== currentTable?.base_id))
          tab.title = `${tab.title}${currentBase?.alias ? ` (${currentBase.alias})` : ``}`

        if (index === -1) {
          tab.sortsState = tab.sortsState || new Map()
          tab.filterState = tab.filterState || new Map()
          tabs.value.push(tab)
          index = tabs.value.length - 1
        }

        return index
      } else if (routeName.includes('projectType-projectId-index-index-auth')) {
        return tabs.value.findIndex((t) => t.type === TabType.AUTH)
      } else if (routeName.includes('projectType-projectId-index-index-sql')) {
        return tabs.value.findIndex((t) => t.type === TabType.SQL)
      } else if (routeName.includes('projectType-projectId-index-index-erd-baseId')) {
        return tabs.value.findIndex((t) => t.id === `${TabType.ERD}-${route.params.baseId}`)
      } else if (routeName.includes('projectType-projectId-index-index-doc')) {
        return tabs.value.findIndex((t) => t.id === route.params.projectId)
      }

      // by default, it's showing Team & Auth
      return 0
    },
    set(index: number) {
      if (index === -1) {
        navigateTo({
          path: `/ws/${workspaceId}/${projectType}/${project?.id}`,
          query: route.query,
        })
      } else {
        const tab = tabs.value[index]

        if (!tab) return

        if (tab.projectId) {
          projectsStore
            .loadProject(tab.projectId)
            .then(() => {
              if (tab.type !== TabType.DOCUMENT) projectsStore.loadProjectTables(tab.projectId!)
            })
            .then(() => {
              navigateToTab(tab)
            })
        } else {
          navigateToTab(tab)
        }
      }
    },
  })

  watch(activeTabIndex, (_, old) => {
    previousActiveTabIndex.value = old
  })

  const activeTab = computed(() => tabs.value?.[activeTabIndex.value])

  const addTab = async (tabMeta: TabItem) => {
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
      if (tabMeta.projectId) {
        await projectsStore.loadProject(tabMeta.projectId)
        if (tabMeta.type !== TabType.DOCUMENT) {
          await projectsStore.loadProjectTables(tabMeta.projectId)
        }
      }
      const currentTable = tables.find((t) => t.id === tabMeta.id || t.title === tabMeta.id)
      const currentBase = projectStore.bases.find((b) => b.id === currentTable?.base_id)

      tabMeta.meta = currentTable?.meta

      // append base alias to tab title if duplicate titles exist on other bases
      if (tables.find((t) => t.title === currentTable?.title && t.base_id !== currentTable?.base_id))
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
        await navigateTo({
          path: `/ws/${workspaceId}/${projectType}/${route.params.projectId}`,
          query: route.query,
        })
      } else {
        await navigateToTab(tabs.value?.[newTabIndex])
      }
    }

    tabs.value.splice(index, 1)
  }

  function navigateToTab(tab: TabItem) {
    switch (tab.type) {
      case TabType.TABLE:
        return navigateTo({
          path: `/ws/${workspaceId}/${projectType}/${tab.projectId}/table/${tab?.id}${tab.viewTitle ? `/${tab.viewTitle}` : ''}`,
          query: route.query,
        })
      case TabType.VIEW:
        return navigateTo({
          path: `/ws/${workspaceId}/${projectType}/${tab.projectId}/view/${tab?.id}${tab.viewTitle ? `/${tab.viewTitle}` : ''}`,
          query: route.query,
        })
      case TabType.AUTH:
        return navigateTo({ path: `/ws/${workspaceId}/${projectType}/${tab.projectId}/auth`, query: route.query })
      case TabType.SQL:
        return navigateTo({ path: `/ws/${workspaceId}/${projectType}/${tab.projectId}/sql`, query: route.query })
      case TabType.ERD:
        return navigateTo({
          path: `/ws/${workspaceId}/${projectType}/${tab.projectId}/erd/${tab?.tabMeta?.base.id}`,
          query: route.query,
        })
      case TabType.DOCUMENT:
        return navigateTo({
          path: nestedUrl({
            projectId: tab.projectId!,
            id: tab.id!,
          }),
          query: route.query,
        })
    }
  }

  const updateTab = (key: number | Partial<TabItem>, newTabItemProps: Partial<TabItem>) => {
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
    () => route.name,
    (n, o) => {
      if (n === o) return
      if (!n || !/projectType-projectId-index-index/.test(n.toString())) return
      const activeTabRoute = n.toString().replace(/ws-workspaceId-projectType-projectId-index-index-/, '')
      switch (activeTabRoute) {
        case TabType.SQL:
          addTab({ id: TabType.SQL, type: TabType.SQL, title: 'SQL Editor', projectId: route.params.projectId as string })
          break
        case TabType.AUTH:
          if (isUIAllowed('teamAndAuth'))
            addTab({
              id: TabType.AUTH,
              type: TabType.AUTH,
              title: t('title.teamAndAuth'),
              projectId: route.params.projectId as string,
            })
          break
        default:
          break
      }
    },
    { immediate: true },
  )

  return { tabs, addTab, activeTabIndex, activeTab, clearTabs, closeTab, updateTab }
})
