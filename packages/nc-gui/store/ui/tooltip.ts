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

export type TooltipTextType = string | VNode

export const useTooltipStore = defineStore('tooltip', () => {
  const placement = ref<'top' | 'bottom' | 'left' | 'right'>('top')
  const tooltipText = ref<TooltipTextType>('')

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

  function showTooltip({
    text,
    rect,
  }: {
    text: TooltipTextType
    /**
     * Todo: Show tooltip at mouse position if showAtMousePosition is true & targetWidth is provided
     */
    rect: RenderRectangleProps & { showAtMousePosition?: boolean }
    mousePosition: {
      x: number
      y: number
    }
  }) {
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
      width: rect.targetWidth || rect.width,
      height: rect.height,
    }
  }

  function tryShowTooltip({
    text,
    description,
    rect,
    mousePosition,
  }: {
    text: TooltipTextType
    description?: string
    rect?: RenderRectangleProps & { showAtMousePosition?: boolean }
    mousePosition: {
      x: number
      y: number
    }
  }) {
    console.log('text', text)
    if (!rect || !isBoxHovered(rect, mousePosition) || !text) return false

    const tooltipWithDescription =
      ncIsString(text) && description
        ? h('div', { class: 'flex flex-col gap-1' }, [
            h('div', { class: 'text-captionBold' }, text),
            h('div', { class: 'text-captionSm' }, description),
          ])
        : text

    showTooltip({ text: tooltipWithDescription, rect, mousePosition })
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
