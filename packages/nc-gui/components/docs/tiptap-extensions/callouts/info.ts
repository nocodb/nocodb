import { Node, mergeAttributes } from '@tiptap/core'

export interface InfoCalloutOptions {
  HTMLAttributes: Record<string, any>
}

export const InfoCallout = Node.create<InfoCalloutOptions>({
  name: 'infoCallout',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'info-callout items-baseline relative',
      },
    }
  },
  content: 'inline*',

  group: 'block',

  defining: true,

  topNode: true,

  parseHTML() {
    return [
      {
        tag: 'div.info-callout',
        contentElement: (element: HTMLElement) => {
          return element.querySelector('.info-callout-text')
        },
      },
    ] as any
  },

  renderHTML({ HTMLAttributes }) {
    // With icon and text
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      [
        'div',
        {
          class: 'info-callout-icon pr-2',
        },
        [
          'img',
          {
            src: `${import.meta.env.BASE_URL}/assets/img/info-icon.svg`,
            alt: 'info',
            style: 'color: #2696DB; min-width: 1rem; width: 1rem; position: absolute; top: 0.75rem; left: 0.5rem; margin',
            draggable: 'false',
          },
        ],
      ],
      ['div', { class: 'info-callout-text text-base ml-6' }, 0],
    ]
  },
})
