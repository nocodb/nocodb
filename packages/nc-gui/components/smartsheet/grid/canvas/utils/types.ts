export interface RenderSingleLineTextProps {
  x: number
  y: number
  text: string
  maxWidth?: number
  fontSize?: number
  fontFamily?: string
  fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter'
  textAlign?: 'left' | 'right' | 'center' | 'start' | 'end'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  fillStyle?: string
  height: number
}
