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

  /**
   * Need to render or just return truncated text
   */
  render?: boolean
}
