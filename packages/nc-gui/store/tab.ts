import type { BaseType, SourceType } from 'nocodb-sdk'
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

  const closeTab = async (_key: number | Partial<TabItem>) => {}

  const updateTab = (_key: number | Partial<TabItem>, _newTabItemProps: Partial<TabItem>) => {}

  return { tabs, addTab, activeTabIndex, activeTab, clearTabs, closeTab, updateTab, addErdTab, addSqlEditorTab }
})
