import { isAIPromptCol } from 'nocodb-sdk'
import { renderMultiLineText, renderTagLabel } from '../utils/canvas'
import { AILongTextCellRenderer } from './AILongText'

export const LongTextCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    if (isAIPromptCol(props.column)) {
      AILongTextCellRenderer.render(ctx, props)
      return
    }

    const { value, x, y, width, height, pv, padding, textColor = '#4a5268' } = props

    const text = value?.toString() ?? ''

    if (!text) {
      return {
        x,
        y,
      }
    }

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: pv ? '#4351e8' : textColor,
        height,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  handleClick: async (props) => {
    if (isAIPromptCol(props.column?.columnObj)) {
      return AILongTextCellRenderer.handleClick?.(props)
    } else {
      return false
    }
  },
  handleHover: async (props) => {
    if (isAIPromptCol(props.column?.columnObj)) {
      return AILongTextCellRenderer.handleHover?.(props)
    } else {
      return false
    }
  },
}
