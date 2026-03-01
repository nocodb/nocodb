import { useStorage } from '@vueuse/core'
import { MINI_SIDEBAR_V2_DOCK_WIDTH, MINI_SIDEBAR_V2_RAIL_WIDTH } from '~/lib/constants'

export type MiniSidebarMode = 'rail' | 'dock'

export const useMiniSidebarMode = createSharedComposable(() => {
  const mode = useStorage<MiniSidebarMode>('nc-mini-sidebar-mode', 'rail')

  const isRail = computed(() => mode.value === 'rail')

  const isDock = computed(() => mode.value === 'dock')

  const toggleMode = () => {
    mode.value = mode.value === 'rail' ? 'dock' : 'rail'
  }

  const currentWidth = computed(() => {
    return mode.value === 'rail' ? MINI_SIDEBAR_V2_RAIL_WIDTH : MINI_SIDEBAR_V2_DOCK_WIDTH
  })

  return {
    mode,
    isRail,
    isDock,
    toggleMode,
    currentWidth,
  }
})
