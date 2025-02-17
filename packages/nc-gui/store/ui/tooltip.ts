import { isBoxHovered } from '../../components/smartsheet/grid/canvas/utils/canvas'
import type { RenderRectangleProps } from '../../components/smartsheet/grid/canvas/utils/types'

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
  const placement = ref<'top' | 'bottom' | 'left' | 'right'>('top')
  const tooltipText = ref('')

  const targetRect = ref<Omit<DOMRect, 'toJSON'>>({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 })

  const hideTooltip = () => {
    tooltipText.value = ''
  }

  const targetReference = computed(() => {
    const rect = targetRect.value
    return {
      getBoundingClientRect() {
        return rect
      },
    }
  })

  function showTooltip({ text, rect }: { text: string; rect: RenderRectangleProps }) {
    if (!text) return

    let canvasX = 0
    let canvasY = 0
    const canvasRect = document.querySelector('canvas')?.getBoundingClientRect()

    if (canvasRect) {
      canvasX = canvasRect.x
      canvasY = canvasRect.y
    }
    rect.x += canvasX
    rect.y += canvasY
    tooltipText.value = text
    targetRect.value = {
      x: rect.x,
      y: rect.y,
      left: rect.x,
      top: rect.y,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      width: rect.width,
      height: rect.height,
    }
  }

  function tryShowTooltip({
    text,
    rect,
    mousePosition,
  }: {
    text: string
    rect?: RenderRectangleProps
    mousePosition: {
      x: number
      y: number
    }
  }) {
    if (!rect || !isBoxHovered(rect, mousePosition) || !text) return false

    showTooltip({ text, rect })
    return true
  }

  return {
    targetReference,
    tooltipText,
    placement,
    tryShowTooltip,
    showTooltip,
    hideTooltip,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTooltipStore as any, import.meta.hot))
}
