import type Moveable from 'vue3-moveable'

export const Removable = {
  name: 'removable',
  props: ['deleteWidget'],
  events: [],
  render(moveable: Moveable, renderer: any) {
    const rect = moveable.getRect()
    return renderer.createElement(
      'div',
      {
        key: 'removable',
        className:
          'moveable-removable border-0 border-nc-border-brand text-nc-fill-primary absolute rounded-[4px] cursor-pointer',
        style: {
          left: `${rect.width - 18}px`,
          top: `-24px`,
        },
        onClick() {
          moveable.props?.deleteWidget()
        },
      },
      renderer.createElement(
        'span',
        {
          class: 'material-symbols text-red-500 text-[18px]',
        },
        'delete',
      ),
    )
  },
}
