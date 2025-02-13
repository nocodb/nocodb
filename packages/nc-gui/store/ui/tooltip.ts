export interface TooltipPosition {
  x: number
  y: number
}

export interface TooltipInfo {
  text: string
  position: TooltipPosition
  theme?: 'light' | 'dark'
}

export const useTooltipStore = defineStore('tooltip', () => {
  const tooltip = ref<TooltipInfo | null>(null)
  const containerSize = ref({ width: 0, height: 0 })

  const showTooltip = (info: TooltipInfo) => {
    tooltip.value = info
  }

  const hideTooltip = () => {
    tooltip.value = null
  }

  return {
    containerSize,
    tooltip,
    showTooltip,
    hideTooltip,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTooltipStore as any, import.meta.hot))
}
