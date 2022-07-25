import { useState } from '#app'

export interface TabItem {
  type: 'table' | 'view' | 'auth'
  title: string
  id?: string
}

function getPredicate(key: Partial<TabItem>) {
  return (tab: TabItem) =>
    (!('id' in key) || tab.id === key.id) &&
    (!('title' in key) || tab.title === key.id) &&
    (!('type' in key) || tab.type === key.id)
}

export default () => {
  const tabs = useState<TabItem[]>('tabs', () => [])
  const activeTab = useState<number>('activeTab', () => 0)

  const addTab = (tabMeta: TabItem) => {
    const tabIndex = tabs.value.findIndex((tab) => tab.id === tabMeta.id)
    // if tab already found make it active
    if (tabIndex > -1) {
      activeTab.value = tabIndex
    }
    // if tab not found add it
    else {
      tabs.value = [...(tabs.value || []), tabMeta]
      activeTab.value = tabs.value.length - 1
    }
  }
  const clearTabs = () => {
    tabs.value = []
  }

  const closeTab = (key: number | Partial<TabItem>) => {
    if (typeof key === 'number') tabs.value.splice(key, 1)
    else {
      const index = tabs.value.findIndex(getPredicate(key))
      if (index > -1) tabs.value.splice(index, 1)
    }
  }

  const updateTab = (key: number | Partial<TabItem>, newTabItemProps: Partial<TabItem>) => {
    const tab = typeof key === 'number' ? tabs.value[key] : tabs.value.find(getPredicate(key))
    if (tab) {
      Object.assign(tab, newTabItemProps)
    }
  }

  return { tabs, addTab, activeTab, clearTabs, closeTab, updateTab }
}
