import { acceptHMRUpdate, defineStore } from 'pinia'
import { isDrawerOrModalExist, useEventListener } from '#imports'

export const useProjectsShortcuts = defineStore('projectsShortcutsStore', () => {
  const { $e } = useNuxtApp()
  const { isUIAllowed } = useUIPermission()

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
          // 'ALT + ,'
          case 188: {
            if (isUIAllowed('settings') && !isDrawerOrModalExist()) {
              $e('c:shortcut', { key: 'ALT + ,' })
              const projectsStore = useProjects()

              if (!projectsStore.activeProjectId) return

              projectsStore.navigateToProject({
                projectId: projectsStore.activeProjectId,
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
