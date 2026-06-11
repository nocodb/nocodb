export function getSafe2DContext<T extends HTMLCanvasElement | OffscreenCanvas>(
  canvas: T,
  throwError = false,
): T extends HTMLCanvasElement ? CanvasRenderingContext2D : OffscreenCanvasRenderingContext2D {
  // get 2D context (may be null)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null

  if (!ctx) {
    if (throwError) {
      throw new Error('2D canvas context not available')
    }

    return null as any
  }

  // patch missing functions safely
  return patchContext(ctx) as any
}

export function patchContext<T extends CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D>(ctx: T): T {
  // -----------------------------
  // roundRect (older browsers)
  // -----------------------------
  if (typeof (ctx as any).roundRect !== 'function') {
    ;(ctx as any).roundRect = function (
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number | number[] | { topLeft?: number; topRight?: number; bottomRight?: number; bottomLeft?: number } = 0,
    ): CanvasRenderingContext2D {
      let r = {
        topLeft: 0,
        topRight: 0,
        bottomRight: 0,
        bottomLeft: 0,
      }

      if (typeof radius === 'number') {
        r = { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius }
      } else if (Array.isArray(radius)) {
        r = {
          topLeft: radius[0] ?? 0,
          topRight: radius[1] ?? radius[0] ?? 0,
          bottomRight: radius[2] ?? radius[0] ?? 0,
          bottomLeft: radius[3] ?? radius[1] ?? radius[0] ?? 0,
        }
      } else {
        r = {
          topLeft: radius.topLeft ?? 0,
          topRight: radius.topRight ?? 0,
          bottomRight: radius.bottomRight ?? 0,
          bottomLeft: radius.bottomLeft ?? 0,
        }
      }

      const tl = Math.min(r.topLeft, width / 2, height / 2)
      const tr = Math.min(r.topRight, width / 2, height / 2)
      const br = Math.min(r.bottomRight, width / 2, height / 2)
      const bl = Math.min(r.bottomLeft, width / 2, height / 2)

      this.beginPath()
      this.moveTo(x + tl, y)
      this.lineTo(x + width - tr, y)
      this.quadraticCurveTo(x + width, y, x + width, y + tr)
      this.lineTo(x + width, y + height - br)
      this.quadraticCurveTo(x + width, y + height, x + width - br, y + height)
      this.lineTo(x + bl, y + height)
      this.quadraticCurveTo(x, y + height, x, y + height - bl)
      this.lineTo(x, y + tl)
      this.quadraticCurveTo(x, y, x + tl, y)

      return this
    }
  }

  // -----------------------------
  // resetTransform (older browsers)
  // -----------------------------
  if (typeof ctx.resetTransform !== 'function') {
    ctx.resetTransform = function () {
      this.setTransform(1, 0, 0, 1, 0, 0)
    }
  }

  // -----------------------------
  // filter (Android WebView)
  // -----------------------------
  if (!('filter' in ctx)) {
    Object.defineProperty(ctx, 'filter', {
      get: () => 'none',
      set: () => {},
    })
  }

  // -----------------------------
  // imageSmoothingQuality
  // -----------------------------
  if (!('imageSmoothingQuality' in ctx)) {
    Object.defineProperty(ctx, 'imageSmoothingQuality', {
      get: () => 'low',
      set: () => {},
    })
  }

  return ctx
}
