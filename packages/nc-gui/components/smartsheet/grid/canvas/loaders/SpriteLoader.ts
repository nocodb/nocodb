import type { VNode } from 'vue'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

export class SpriteLoader {
  private svgCache = new Map<string, string>()
  private spriteCache = new Map<string, HTMLCanvasElement>()
  private pendingSprites = 0

  constructor(private onSettled?: () => void) {}

  private getCacheKey(icon: IconMapKey | VNode, size: number, color: string): string {
    return `${typeof icon === 'string' ? icon : JSON.stringify(icon)}-${size}-${color}`
  }

  private async loadSvg(icon: IconMapKey | VNode): Promise<string> {
    const iconKey = typeof icon === 'string' ? icon : JSON.stringify(icon)

    const cachedSvg = this.svgCache.get(iconKey)
    if (cachedSvg) return cachedSvg

    const vNode = typeof icon === 'string' ? iconMap[icon] : icon
    const app = createSSRApp(vNode)
    const svg = await renderToString(app)

    this.svgCache.set(iconKey, svg)
    return svg
  }

  async renderIcon(
    ctx: CanvasRenderingContext2D,
    {
      icon,
      size,
      color,
      x,
      y,
      alpha = 1,
    }: {
      icon: IconMapKey | VNode
      size: number
      color: string
      x: number
      y: number
      alpha?: number
    },
  ): Promise<void> {
    const scale = window.devicePixelRatio || 1
    const cacheKey = this.getCacheKey(icon, size, color)

    const cachedSprite = this.spriteCache.get(cacheKey)
    if (cachedSprite) {
      if (alpha < 1) ctx.globalAlpha = alpha
      ctx.drawImage(cachedSprite, x, y, size, size)
      if (alpha < 1) ctx.globalAlpha = 1
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = size * scale
    canvas.height = size * scale
    const spriteCtx = canvas.getContext('2d')!

    spriteCtx.imageSmoothingEnabled = true
    spriteCtx.imageSmoothingQuality = 'high'
    spriteCtx.scale(scale, scale)

    this.spriteCache.set(cacheKey, canvas)

    this.pendingSprites++

    try {
      const svg = await this.loadSvg(icon)
      const img = new Image()
      const blob = new Blob([svg.replaceAll('currentColor', color)], { type: 'image/svg+xml' })
      const objectUrl = URL.createObjectURL(blob)

      try {
        await new Promise<void>((resolve) => {
          img.onload = () => {
            spriteCtx.drawImage(img, 0, 0, size, size)
            this.onSettled?.()
            resolve()
          }
          img.src = objectUrl
        })
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    } finally {
      this.pendingSprites--
      if (this.pendingSprites === 0) {
        this.onSettled?.()
      }
    }
  }

  get isLoading(): boolean {
    return this.pendingSprites > 0
  }

  clearCaches(): void {
    this.svgCache.clear()
    this.spriteCache.clear()
  }
}
