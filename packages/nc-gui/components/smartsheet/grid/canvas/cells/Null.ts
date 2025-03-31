import { SingleLineTextCellRenderer } from './SingleLineText'

export const NullCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    return SingleLineTextCellRenderer.render(ctx, {
      ...props,
      value: 'NULL',
      textColor: '#d5d5d9',
      pv: false,
    })
  },
}
