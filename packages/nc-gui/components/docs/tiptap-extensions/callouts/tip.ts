import { Node, mergeAttributes } from '@tiptap/core'

export interface TipCalloutOptions {
  HTMLAttributes: Record<string, any>
}

export const TipCallout = Node.create<TipCalloutOptions>({
  name: 'tipCallout',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'tip-callout items-baseline relative',
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
        tag: 'div.tip-callout',
        contentElement: (element: HTMLElement) => {
          return element.querySelector('.tip-callout-text')
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
          class: 'tip-callout-icon pr-2',
        },
        [
          'img',
          {
            src: `${import.meta.env.BASE_URL}/assets/img/tip-icon.svg`,
            alt: 'tip',
            style: 'color: #FCBE3A; min-width: 1rem; width: 1rem; position: absolute; top: 0.75rem; left: 0.5rem; margin',
            draggable: 'false',
          },
        ],
      ],
      ['div', { class: 'tip-callout-text text-base ml-6' }, 0],
    ]
  },
})
