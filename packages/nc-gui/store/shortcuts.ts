import { acceptHMRUpdate, defineStore } from 'pinia'
import { isDrawerOrModalExist, useEventListener } from '#imports'

export const useShortcutsStore = defineStore('shortcutsStore', () => {
  const { $e } = useNuxtApp()
  const isMounted = ref(false)

  const isFullScreen = ref(false)

  const workspaceStore = useWorkspace()

  workspaceStore.$subscribe(() => {
    if (!isMounted.value) {
      isMounted.value = true
    }
  })

  watch(isMounted, () => {
    useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
      const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey

      if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
        switch (e.keyCode) {
          case 70: {
            // ALT + F
            if (!isDrawerOrModalExist()) {
              $e('c:shortcut', { key: 'ALT + F' })
              const sidebarStore = useSidebarStore()

              isFullScreen.value = !isFullScreen.value

              sidebarStore.isLeftSidebarOpen = !isFullScreen.value
              sidebarStore.isRightSidebarOpen = !isFullScreen.value
            }
            break
          }
        }
      }
    })
  })
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useShortcutsStore as any, import.meta.hot))
}
