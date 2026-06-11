import { acceptHMRUpdate, defineStore } from 'pinia'

export const useProjectsShortcuts = defineStore('projectsShortcutsStore', () => {
  const { $e } = useNuxtApp()
  const { isUIAllowed } = useRoles()

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
            if (!isDrawerOrModalExist() && !isActiveInputElementExist()) {
              $e('c:shortcut', { key: 'ALT + F' })
              const sidebarStore = useSidebarStore()

              isFullScreen.value = !isFullScreen.value

              sidebarStore.isLeftSidebarOpen = !isFullScreen.value
              sidebarStore.isRightSidebarOpen = !isFullScreen.value
            }
            break
          }
          // 'ALT + ,'
          case 188: {
            if (isUIAllowed('settingsPage') && !isDrawerOrModalExist() && !isActiveInputElementExist()) {
              $e('c:shortcut', { key: 'ALT + ,' })
              const basesStore = useBases()

              if (!basesStore.activeProjectId) return

              basesStore.navigateToProject({
                baseId: basesStore.activeProjectId,
                page: 'collaborators',
              })
            }
            break
          }
        }
      }
    })
  })
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useProjectsShortcuts as any, import.meta.hot))
}
