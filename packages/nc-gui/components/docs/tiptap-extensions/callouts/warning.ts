import { Node, mergeAttributes } from '@tiptap/core'

export interface WarningCalloutOptions {
  HTMLAttributes: Record<string, any>
}

export const WarningCallout = Node.create<WarningCalloutOptions>({
  name: 'warningCallout',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'warning-callout items-baseline relative',
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
        tag: 'div.warning-callout',
        contentElement: (element: HTMLElement) => {
          return element.querySelector('.warning-callout-text')
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
          class: 'warning-callout-icon pr-2',
        },
        [
          'img',
          {
            src: `${import.meta.env.BASE_URL}/assets/img/error-icon.svg`,
            alt: 'warning',
            style: 'color: #FF4A3F; min-width: 1rem; width: 1rem; position: absolute; top: 0.75rem; left: 0.5rem; margin',
            draggable: 'false',
          },
        ],
      ],
      ['div', { class: 'warning-callout-text text-base ml-6' }, 0],
    ]
  },
})
