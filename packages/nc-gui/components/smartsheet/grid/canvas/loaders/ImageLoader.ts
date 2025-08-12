import QRCode from 'qrcode'
import { renderMultiLineText } from '../utils/canvas'

export class ImageWindowLoader {
  private cache = new Map<string, HTMLImageElement>()
  private qrCache = new Map<string, HTMLCanvasElement>()
  private loadingImages = new Map<string, Promise<HTMLImageElement | undefined>>()
  private loadingQRs = new Map<string, Promise<HTMLCanvasElement | undefined>>()
  private failedUrls = new Map<string, { retryCount: number; lastFailedAt: number }>() // Track retry info
  private retryTimers = new Map<string, NodeJS.Timeout>() // Track scheduled retry callbacks
  private readonly maxRetries = 3 // Allow up to 3 retries
  private readonly backoffDelays = [2000, 5000, 8000] // 2s, 5s, 8s backoff

  private pendingSprites = 0
  constructor(private onSettled?: () => void) {}

  private getQRCacheKey(value: string, size: number, dark: string, light: string): string {
    return `qr-${value}-${size}-${dark}-${light}`
  }

  private canRetryUrl(url: string): boolean {
    const failureInfo = this.failedUrls.get(url)
    if (!failureInfo) return true

    if (failureInfo.retryCount >= this.maxRetries) return false

    const backoffDelay = this.backoffDelays[Math.min(failureInfo.retryCount, this.backoffDelays.length - 1)]
    const timeSinceLastFailure = Date.now() - failureInfo.lastFailedAt

    return timeSinceLastFailure >= backoffDelay
  }

  private recordFailure(url: string): void {
    const existing = this.failedUrls.get(url)
    this.failedUrls.set(url, {
      retryCount: (existing?.retryCount || 0) + 1,
      lastFailedAt: Date.now(),
    })

    // Schedule a callback when this URL becomes retryable again
    this.scheduleRetryCallback(url)
  }

  private scheduleRetryCallback(url: string): void {
    // Clear any existing timer for this URL
    const existingTimer = this.retryTimers.get(url)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const failureInfo = this.failedUrls.get(url)
    if (!failureInfo || failureInfo.retryCount >= this.maxRetries) return

    const backoffDelay = this.backoffDelays[Math.min(failureInfo.retryCount, this.backoffDelays.length - 1)]
    const timeSinceLastFailure = Date.now() - failureInfo.lastFailedAt
    const remainingDelay = Math.max(0, backoffDelay - timeSinceLastFailure)

    const timer = setTimeout(() => {
      this.retryTimers.delete(url)
      this.onSettled?.()
    }, remainingDelay)

    this.retryTimers.set(url, timer)
  }

  private clearRetryTimer(url: string): void {
    const timer = this.retryTimers.get(url)
    if (timer) {
      clearTimeout(timer)
      this.retryTimers.delete(url)
    }
  }

  loadOrGetImage(urls: string[] | string): HTMLImageElement | undefined {
    urls = Array.isArray(urls) ? urls : [urls]

    // Check if we have a cached image first
    for (const url of urls) {
      const cachedImage = this.cache.get(url)
      if (cachedImage) return cachedImage
    }

    // Check if any URL is currently loading
    const isAnyLoading = urls.some((url) => this.loadingImages.has(url))
    if (isAnyLoading) {
      return undefined
    }

    // Find a URL that can be retried (hasn't exceeded limit and backoff time has passed)
    const urlToLoad = urls.find((url) => this.canRetryUrl(url))
    if (!urlToLoad) return undefined

    const loadPromise = (async () => {
      try {
        const image = await this.loadImage(urlToLoad)
        if (image) {
          // Reset retry info on success
          this.failedUrls.delete(urlToLoad)
          this.clearRetryTimer(urlToLoad)
          return image
        }

        // Record failure
        this.recordFailure(urlToLoad)
      } catch {
        this.recordFailure(urlToLoad)
      }

      // Try remaining URLs
      for (const url of urls.slice(urls.indexOf(urlToLoad) + 1)) {
        if (!this.canRetryUrl(url)) continue

        try {
          const nextImage = await this.loadImage(url)
          if (nextImage) {
            this.failedUrls.delete(url)
            this.clearRetryTimer(url)
            return nextImage
          }
          this.recordFailure(url)
        } catch {
          this.recordFailure(url)
        }
      }
      return undefined
    })().finally(() => {
      // Clean up loading promises
      for (const url of urls) {
        this.loadingImages.delete(url)
      }
    })

    this.loadingImages.set(urlToLoad, loadPromise)
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
      this.onSettled?.()
    }
  }

  renderQRCode(ctx: CanvasRenderingContext2D, qrCanvas: HTMLCanvasElement, x: number, y: number, size: number): void {
    ctx.drawImage(qrCanvas, x, y, size, size)
  }

  private async loadImage(url: string): Promise<HTMLImageElement | undefined> {
    const img = new Image()
    this.pendingSprites++

    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          resolve()
        }
        img.onerror = () => {
          reject(new Error('Failed to load image'))
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
      this.onSettled?.()
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
    borderOptions: {
      border?: boolean
      borderColor?: string
      borderWidth?: number
    },
    objectFit: 'contain' | 'cover' | 'fill' = 'cover',
  ): void {
    const { border = false, borderColor = '#e5e7eb', borderWidth = 1 } = borderOptions

    ctx.save()

    if (border) {
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, borderRadius)
      ctx.strokeStyle = borderColor
      ctx.lineWidth = borderWidth
      ctx.stroke()
    }

    if (borderRadius > 0) {
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, borderRadius)
      ctx.clip()
    }

    ctx.beginPath()
    ctx.roundRect(
      x + (border ? borderWidth / 2 : 0),
      y + (border ? borderWidth / 2 : 0),
      width - (border ? borderWidth : 0),
      height - (border ? borderWidth : 0),
      Math.max(0, borderRadius - (border ? borderWidth / 2 : 0)),
    )
    ctx.clip()

    // Adjust width & height to account for the border
    const availableWidth = width - (border ? borderWidth : 0)
    const availableHeight = height - (border ? borderWidth : 0)

    // Calculate scale and position based on objectFit
    let scaleX = availableWidth / image.width
    let scaleY = availableHeight / image.height
    let scale: number
    let offsetX = 0
    let offsetY = 0

    if (objectFit === 'contain') {
      scale = Math.min(scaleX, scaleY) // Scale to fit inside the box
      offsetX = (availableWidth - image.width * scale) / 2
      offsetY = (availableHeight - image.height * scale) / 2
    } else if (objectFit === 'cover') {
      scale = Math.max(scaleX, scaleY) // Scale to cover the entire box
      offsetX = (availableWidth - image.width * scale) / 2
      offsetY = (availableHeight - image.height * scale) / 2
    } else {
      // 'fill' mode - stretch to fit exactly
      scaleX = availableWidth / image.width
      scaleY = availableHeight / image.height
      scale = 1
    }

    // Draw the image with proper scaling & border consideration
    ctx.drawImage(
      image,
      x + offsetX + (border ? borderWidth / 2 : 0),
      y + offsetY + (border ? borderWidth / 2 : 0),
      image.width * (objectFit === 'fill' ? scaleX : scale),
      image.height * (objectFit === 'fill' ? scaleY : scale),
    )
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

    // Clear all retry timers
    this.retryTimers.forEach((timer) => clearTimeout(timer))
    this.retryTimers.clear()
    this.failedUrls.clear()
  }

  get isLoading(): boolean {
    return this.pendingSprites > 0
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
    ctx.font = '500 13px Inter'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#e65100'
    renderMultiLineText(ctx, {
      text,
      x: x + padding,
      y: y + height / 2,
      maxWidth: width - padding * 2,
      lineHeight: 16,
    })
  }
}
