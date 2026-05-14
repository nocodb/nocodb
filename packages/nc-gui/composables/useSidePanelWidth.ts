import { useStorage } from '@vueuse/core'

// Shared width for right-side detail panels (expanded record + SmartText cell).
// Each panel keeps its own fullscreen state; in side-panel mode they read/write
// the same width so toggling between them never shifts the layout.
export const useSidePanelWidth = createSharedComposable(() => {
  return useStorage('nc-side-panel-width', 480)
})
