import type { SpriteLoader } from '../loaders/SpriteLoader'

export interface RenderSingleLineTextProps {
  text: string
  x?: number
  y?: number
  maxWidth?: number
  fontSize?: number
  fontFamily?: string
  fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter'
  textAlign?: 'left' | 'right' | 'center' | 'start' | 'end'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  fillStyle?: string
  height?: number
  underline?: boolean
  py?: number
  px?: number

  /**
   * Need to render or just return truncated text
   */
  render?: boolean
  isTagLabel?: boolean

  spriteLoader?: SpriteLoader
  cellRenderStore?: CellRenderStore
}

export interface RenderMultiLineTextProps extends RenderSingleLineTextProps {
  maxLines?: number
  lineHeight?: number
  mousePosition?: { x: number; y: number }
}

export interface RenderRectangleProps {
  x: number
  y: number
  width: number
  height: number
}

export interface RenderTagProps extends RenderRectangleProps {
  radius: number | DOMPointInit | Iterable<number | DOMPointInit>
  fillStyle?: string | CanvasGradient | CanvasPattern
  borderColor?: string
  borderWidth?: number
}
