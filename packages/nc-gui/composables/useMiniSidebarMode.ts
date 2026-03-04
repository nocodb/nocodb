import { useStorage } from '@vueuse/core'

export type MiniSidebarMode = 'rail' | 'dock'

export const useMiniSidebarMode = createSharedComposable(() => {
  const mode = useStorage<MiniSidebarMode>('nc-mini-sidebar-mode', 'rail')

  const isRail = computed(() => mode.value === 'rail')

  const toggleMode = () => {
    mode.value = mode.value === 'rail' ? 'dock' : 'rail'
  }

  return {
    mode,
    isRail,
    toggleMode,
  }
})
