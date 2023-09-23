import { defineStore } from 'pinia'

export const useSidebarStore = defineStore('sidebarStore', () => {
  const { isViewPortMobile } = useConfigStore()

  const isLeftSidebarOpen = ref(!isViewPortMobile())
  const isRightSidebarOpen = ref(true)

  const leftSidebarWidthPercent = ref(isViewPortMobile() ? 0 : 20)

  const leftSideBarSize = ref({
    old: 20,
    current: leftSidebarWidthPercent.value,
  })

  const rightSidebarSize = ref({
    old: 17.5,
    current: 17.5,
  })

  const leftSidebarState = ref<
    'openStart' | 'openEnd' | 'hiddenStart' | 'hiddenEnd' | 'peekOpenStart' | 'peekOpenEnd' | 'peekCloseOpen' | 'peekCloseEnd'
  >(isLeftSidebarOpen.value ? 'openEnd' : 'hiddenEnd')

  const rightSidebarState = ref<
    'openStart' | 'openEnd' | 'hiddenStart' | 'hiddenEnd' | 'peekOpenStart' | 'peekOpenEnd' | 'peekCloseOpen' | 'peekCloseEnd'
  >(isRightSidebarOpen.value ? 'openEnd' : 'hiddenEnd')

  return {
    isLeftSidebarOpen,
    isRightSidebarOpen,
    rightSidebarSize,
    leftSidebarWidthPercent,
    leftSideBarSize,
    leftSidebarState,
    rightSidebarState,
  }
})
