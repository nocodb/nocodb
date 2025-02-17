import type { VNode } from 'vue'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

export class SpriteLoader {
  private spriteCache = new Map<string, HTMLCanvasElement>()

  constructor() {
    this.spriteCache = new Map<string, HTMLCanvasElement>()
  }

  private async loadSvg(icon: IconMapKey | VNode) {
    const vNode = typeof icon === 'string' ? iconMap[icon] : icon
    const app = createSSRApp(vNode)
    return await renderToString(app)
  }

  async loadSprite(icon: IconMapKey | VNode, size: number, color: string) {
    const canvas = document.createElement('canvas')
    const scale = window.devicePixelRatio || 1
    canvas.width = size * scale
    canvas.height = size * scale

    const ctx = canvas.getContext('2d')!

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.scale(scale, scale)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const svg = (await this.loadSvg(icon)).replaceAll('currentColor', color)
    if (!svg) return

    const img = new Image()
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    img.src = URL.createObjectURL(blob)

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size)
        URL.revokeObjectURL(img.src)
        resolve()
      }
      img.onerror = (err) => {
        URL.revokeObjectURL(img.src)
        reject(err)
      }
    })

    return canvas
  }

  async renderIcon(
    ctx: CanvasRenderingContext2D,
    {
      icon,
      size,
      color,
      x,
      y,
    }: {
      icon: IconMapKey | VNode
      size: number
      color: string
      x: number
      y: number
    },
  ) {
    const cacheKey = `${JSON.stringify(icon)}-${size}-${color}`
    let sprite = this.spriteCache.get(cacheKey)

    if (!sprite) {
      sprite = await this.loadSprite(icon, size, color)
      if (!sprite) return
      this.spriteCache.set(cacheKey, sprite)
    }
    ctx.drawImage(sprite, x, y, size, size)
  }
}
