import type Moveable from 'vue3-moveable'

export const Removable = {
  name: 'removable',
  props: ['deleteWidget'],
  events: [],
  render(moveable: Moveable, renderer: any) {
    const rect = moveable.getRect()
    const rotatable = moveable.props?.rotatable
    return renderer.createElement(
      'div',
      {
        key: 'removable',
        className:
          'moveable-removable absolute w-5 h-5 px-2 bg-white rounded-md hover:bg-gray-100 border-1 cursor-pointer border-nc-border-gray-medium justify-center items-center gap-2 inline-flex',
        style: {
          left: `${rect.width - (rotatable ? 15 : 9)}px`,
          top: rotatable ? `-30px` : `-10px`,
          boxShadow: '0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02)',
        },
        onClick() {
          moveable.props?.deleteWidget()
        },
      },
      renderer.createElement(
        'span',
        {
          class: 'material-symbols text-nc-content-gray-subtle text-[16px]',
        },
        'close',
      ),
    )
  },
}
