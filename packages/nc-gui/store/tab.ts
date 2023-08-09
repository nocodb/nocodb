import type { BaseType, ProjectType } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'
import { defineStore } from 'pinia'
import { TabType, computed, ref } from '#imports'
import type { TabItem } from '#imports'

export const useTabs = defineStore('tabStore', () => {
  const tabs = ref<TabItem[]>([])

  const activeTabIndex: WritableComputedRef<number> = computed({
    get() {
      return 0
    },
    set(_index: number) {},
  })

  const activeTab = computed(() => ({} as TabItem))

  const addTab = async (_tabMeta: TabItem) => {}

  const addErdTab = async (base: BaseType, fallback_title?: string) => {
    return addTab({
      id: `${TabType.ERD}-${base?.id}`,
      type: TabType.ERD,
      title: `ERD${base?.alias ? ` (${base.alias})` : `(${fallback_title})`}`,
      tabMeta: { base },
      projectId: base.project_id as string,
    })
  }

  const addSqlEditorTab = async (project: ProjectType) => {
    return addTab({
      id: `${TabType.SQL}-${project.id}`,
      type: TabType.SQL,
      title: `SQL Editor (${project.title})`,
      tabMeta: { project },
      projectId: project.id as string,
    })
  }

  const clearTabs = () => {
    tabs.value = []
  }

  const closeTab = async (_key: number | Partial<TabItem>) => {}

  const updateTab = (_key: number | Partial<TabItem>, _newTabItemProps: Partial<TabItem>) => {}

  return { tabs, addTab, activeTabIndex, activeTab, clearTabs, closeTab, updateTab, addErdTab, addSqlEditorTab }
})
