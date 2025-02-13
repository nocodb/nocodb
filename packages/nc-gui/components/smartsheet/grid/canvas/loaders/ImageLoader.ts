export class ImageWindowLoader {
  private cache: Map<string, HTMLImageElement> = new Map()
  private loadQueue: Set<string> = new Set()
  private onLoadCallbacks: ((url: string) => void)[] = []
  constructor() {}

  loadOrGetImage(url: string): HTMLImageElement | undefined {
    if (this.cache.has(url)) {
      return this.cache.get(url)
    }

    if (!this.loadQueue.has(url)) {
      this.loadQueue.add(url)
      this.loadImage(url)
    }

    return undefined
  }

  private loadImage(url: string) {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      this.cache.set(url, img)
      this.loadQueue.delete(url)
      this.onLoadCallbacks.forEach((cb) => cb(url))
    }

    img.onerror = () => {
      this.loadQueue.delete(url)
    }

    img.src = url
  }

  onLoad(callback: (url: string) => void) {
    this.onLoadCallbacks.push(callback)
  }

  clearCache() {
    this.cache.clear()
  }
}
