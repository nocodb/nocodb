import { useStorage } from '@vueuse/core'

// Shared width for right-side detail panels (expanded record + SmartText cell).
// Each panel keeps its own fullscreen state; in side-panel mode they read/write
// the same width so toggling between them never shifts the layout.
// Default 600 px so first-time users land at the expanded record's dual-pane
// threshold (DUAL_PANE_THRESHOLD in ExpandedFormPanel.vue) — the sidebar with
// Comments/History/Fields is visible from the start instead of requiring a
// manual drag.
export const useSidePanelWidth = createSharedComposable(() => {
  return useStorage('nc-side-panel-width', 600)
})
