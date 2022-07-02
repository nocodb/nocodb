import { useState } from '#app'

interface TabItem {
  type: 'table' | 'view'
  title: string
  id: string
}

export const useTabs = () => {
  const tabs = useState<Array<TabItem>>('tabs', () => [])
  const activeTab = useState<number>('activeTab', () => 0)

  const addTab = (tabMeta: TabItem) => {
    tabs.value = [...(tabs.value || []), tabMeta]
    activeTab.value = tabs.value.length - 1
  }
  const clearTabs = () => {
    tabs.value = []
  }

  return { tabs, addTab, activeTab, clearTabs }
}
