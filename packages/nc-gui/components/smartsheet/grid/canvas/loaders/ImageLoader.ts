import QRCode from 'qrcode'
import { truncateText } from '../utils/canvas'

export class ImageWindowLoader {
  private cache = new Map<string, HTMLImageElement>()
  private qrCache = new Map<string, HTMLCanvasElement>()
  private loadingImages = new Map<string, Promise<HTMLImageElement | undefined>>()
  private loadingQRs = new Map<string, Promise<HTMLCanvasElement | undefined>>()
  private pendingSprites = 0
  constructor(private onSettled?: () => void) {}

  private getQRCacheKey(value: string, size: number, dark: string, light: string): string {
    return `qr-${value}-${size}-${dark}-${light}`
  }

  loadOrGetImage(url: string): HTMLImageElement | undefined {
    const cachedImage = this.cache.get(url)
    if (cachedImage) return cachedImage

    if (!this.loadingImages.has(url)) {
      const loadPromise = this.loadImage(url)
      this.loadingImages.set(url, loadPromise)

      loadPromise.finally(() => {
        this.loadingImages.delete(url)
      })
    }

    return undefined
  }

  loadOrGetQR(value: string, size: number, options: { dark?: string; light?: string } = {}): HTMLCanvasElement | undefined {
    const { dark = '#000000', light = '#ffffff' } = options
    const cacheKey = this.getQRCacheKey(value, size, dark, light)

    const cached = this.qrCache.get(cacheKey)
    if (cached) return cached

    if (!this.loadingQRs.has(cacheKey)) {
      const loadPromise = this.generateQR(value, size, dark, light, cacheKey)
      this.loadingQRs.set(cacheKey, loadPromise)

      loadPromise.finally(() => {
        this.loadingQRs.delete(cacheKey)
      })
    }

    return undefined
  }

  private async generateQR(
    value: string,
    size: number,
    dark: string,
    light: string,
    cacheKey: string,
  ): Promise<HTMLCanvasElement | undefined> {
    this.pendingSprites++

    try {
      const canvas = document.createElement('canvas')
      await QRCode.toCanvas(canvas, value, {
        margin: 1,
        scale: 4,
        width: size,
        color: { dark, light },
      })

      this.qrCache.set(cacheKey, canvas)
      return canvas
    } catch {
      return undefined
    } finally {
      this.pendingSprites--
      if (this.pendingSprites === 0) {
        this.onSettled?.()
      }
    }
  }

  renderError(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    padding = 10,
  ): void {
    ctx.font = '500 13px Manrope'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#e65100'
    const truncatedError = truncateText(ctx, text, width - padding * 2)
    ctx.fillText(truncatedError, x + padding, y + height / 2)
  }

  renderQRCode(ctx: CanvasRenderingContext2D, qrCanvas: HTMLCanvasElement, x: number, y: number, size: number): void {
    ctx.drawImage(qrCanvas, x, y, size, size)
  }

  private async loadImage(url: string): Promise<HTMLImageElement | undefined> {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    this.pendingSprites++

    try {
      await new Promise<void>((resolve) => {
        img.onload = () => {
          resolve()
        }
        img.onerror = () => {
          // reject(new Error('Failed to load image'))
        }
        img.src = url
      })

      this.cache.set(url, img)
      return img
    } catch {
      img.src = ''
      return undefined
    } finally {
      this.pendingSprites--
      if (this.pendingSprites === 0) {
        this.onSettled?.()
      }
    }
  }

  renderImage(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
    borderRadius = 4,
  ): void {
    ctx.save()

    if (borderRadius > 0) {
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, borderRadius)
      ctx.clip()
    }

    const scale = Math.max(width / image.width, height / image.height)
    const scaledWidth = image.width * scale
    const scaledHeight = image.height * scale
    const offsetX = (width - scaledWidth) / 2
    const offsetY = (height - scaledHeight) / 2

    ctx.drawImage(image, x + offsetX, y + offsetY, scaledWidth, scaledHeight)
    ctx.restore()
  }

  renderPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, icon: string): void {
    ctx.fillStyle = '#f3f4f6'
    ctx.beginPath()
    ctx.roundRect(x, y, size, size, 4)
    ctx.fill()

    ctx.fillStyle = '#6b7280'
    ctx.font = '12px Material Icons'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(icon, x + size / 2, y + size / 2)
  }

  clearCache(): void {
    this.cache.forEach((img) => {
      img.onload = null
      img.onerror = null
      img.src = ''
    })
    this.cache.clear()
    this.loadingImages.clear()
    this.qrCache.clear()
    this.loadingQRs.clear()
  }

  get isLoading(): boolean {
    return this.pendingSprites > 0
  }
}
