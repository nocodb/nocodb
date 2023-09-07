import { defineStore } from 'pinia'

export const useSidebarStore = defineStore('sidebarStore', () => {
  const isLeftSidebarOpen = ref(true)
  const isRightSidebarOpen = ref(true)
  const leftSidebarWidthPercent = ref(20)

  const leftSideBarSize = ref({
    old: leftSidebarWidthPercent.value,
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

  const viewportWidth = ref(window.innerWidth)

  function onWindowResize() {
    viewportWidth.value = window.innerWidth
  }

  onMounted(() => {
    window.addEventListener('resize', onWindowResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onWindowResize)
  })

  return {
    isLeftSidebarOpen,
    isRightSidebarOpen,
    rightSidebarSize,
    leftSidebarWidthPercent,
    leftSideBarSize,
    leftSidebarState,
    rightSidebarState,
    viewportWidth,
  }
})
