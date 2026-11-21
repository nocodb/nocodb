declare module 'svgcanvas' {
  /** A Canvas 2D context that records drawing as SVG. */
  export class Context {
    constructor(options: { width: number; height: number })
    getSerializedSvg(fixNamedEntities?: boolean): string
  }
}
