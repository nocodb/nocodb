import * as TipTapMention from '@tiptap/extension-mention'

export const Mention = TipTapMention.Mention.extend({
  renderHTML({ HTMLAttributes }) {
    const attributes =
      typeof HTMLAttributes['data-id'] !== 'object' ? JSON.parse(HTMLAttributes['data-id']) : HTMLAttributes['data-id']

    const innerText = attributes.name && attributes.name.length > 0 ? attributes.name : attributes.email

    const styles =
      attributes.isSameUser === true || attributes.isSameUser === 'true'
        ? 'bg-[#D4F7E0] text-[#17803D]'
        : 'bg-brand-50 text-brand-500'

    return [
      'span',
      {
        'class': `mention font-semibold ${styles} rounded-md px-1`,
        'data-type': 'mention',
        'data-id': JSON.stringify(HTMLAttributes['data-id']),
      },
      [
        'span',
        {
          style: 'font-weight: 800;',
        },
        '@',
      ],
      innerText,
    ]
  },
  renderText({ node }) {
    return `@${node.attrs.id.name || node.attrs.id.email || node.attrs.id.id}`
  },
  deleteTriggerWithBackspace: true,
})
