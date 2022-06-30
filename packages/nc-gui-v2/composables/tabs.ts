import {useState} from "#app";

interface TabItem {
  type: 'table' | 'view',
  title: string,
  id:string
}

export const useTabs = () => {
  const tabs = useState<Array<TabItem>>('tabs', () => [])

  const addTab = (tabMeta: TabItem) => {
    tabs.value = [...(tabs.value || []), tabMeta]
  }

  return {tabs, addTab}
}
