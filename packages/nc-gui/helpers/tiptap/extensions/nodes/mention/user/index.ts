import TipTapMention from '@tiptap/extension-mention'
import type MarkdownIt from 'markdown-it'
import regexp from 'markdown-it-regexp'
import type { UserType } from 'nocodb-sdk'

const USER_ID_REGEXP = /@\(([^)]+)\)/

export const parseUserMention = (
  users: (Partial<UserType> | Partial<User>)[] = [],
  currentUser?: Partial<UserType> | Partial<User> | null,
  isReadonly = false,
) => {
  return regexp(USER_ID_REGEXP, (match) => {
    const id = match[1]?.split('|')?.[0]
    const bUser =
      users.find((user) => user?.id && user.id === id) ||
      ({
        id,
        email: match[1]?.split('|')?.[1],
        display_name: match[1]?.split('|')?.[2],
      } as User)

    const processedContent = bUser?.display_name && bUser.display_name.length > 0 ? bUser.display_name : bUser?.email

    let className = 'mention font-semibold rounded-md px-1 inline-block'
    if (bUser.id === currentUser?.id) {
      className += ' bg-[#D4F7E0] text-[#17803D]'
    }

    return `<span class="${className}" data-id='${JSON.stringify({
      id: bUser?.id,
      email: bUser?.email,
      name: bUser?.display_name ?? '',
      isSameUser: bUser?.id === currentUser?.id,
    })}'  data-type="mention">${isReadonly ? '<span>@</span>' : '@'}${processedContent}</span>`
  })
}

export const UserMention = TipTapMention.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      users: [],
      currentUser: {},
    }
  },
  renderHTML({ HTMLAttributes }) {
    const attributes = parseProp(HTMLAttributes['data-id'])

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
        'data-id': HTMLAttributes['data-id'],
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

  deleteTriggerWithBackspace: true,
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const user = node.attrs.id
          if (user?.id) {
            state.write(`@(${user.id}|${user.email ?? ''}|${user.name ?? ''})`)
          }
        },
        parse: {
          setup(markdownit: MarkdownIt) {
            markdownit.use(parseUserMention(this.options.users, this.options.currentUser))
          },
        },
      },
    }
  },
})
