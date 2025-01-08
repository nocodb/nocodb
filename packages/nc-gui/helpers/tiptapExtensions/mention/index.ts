import TipTapMention from '@tiptap/extension-mention'
import regexp from 'markdown-it-regexp'
import type { UserType } from 'nocodb-sdk'

const USER_ID_REGEXP = /@\(([^)]+)\)/

export const parseMention = (
  users: (Partial<UserType> | Partial<User>)[] = [],
  currentUser?: Partial<UserType> | Partial<User> | null,
  isReadonly = false,
) => {
  return regexp(USER_ID_REGEXP, (match, utils) => {
    console.log('mat', match, utils, users, currentUser)
    const id = match[1]?.split('|')?.[0]
    const bUser =
      users.find((user) => user?.id && user.id === id) ||
      ({
        id,
        email: match[1]?.split('|')?.[1],
        display_name: match[1]?.split('|')?.[2],
      } as User)

    const processedContent = bUser?.display_name && bUser.display_name.length > 0 ? bUser.display_name : bUser?.email

    let className = 'mention font-semibold m-0.5 rounded-md px-1 inline-block'
    if (bUser.id === currentUser?.id) {
      className += ' bg-[#D4F7E0] text-[#17803D]'
    }

    console.log('sbse', bUser)

    // NOTE: Keep this in sync with the @tiptap/extension-mention
    // https://github.com/ueberdosis/tiptap/blob/main/packages/extension-mention/src/mention.ts
    return `<span class="${className}" data-id="${JSON.stringify({
      id: bUser?.id,
      email: bUser?.email,
      name: bUser?.display_name ?? '',
      isSameUser: bUser?.id === currentUser?.id,
    })}"  data-type="mention">${isReadonly ? '<span>@</span>' : '@'}${processedContent}</span>`
  })
}

export const Mention = TipTapMention.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      users: [],
      loggedUserId: {},
    }
  },
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
  addStorage() {
    return {
      markdon: {
        serialize(state: any, node: any) {
          if (!node.attrs.id?.id) {
            state.write(`@(${node.attrs.id.id}|${node.attrs.id.email}|${node.attrs.id.name})`)
          }
        },
        parse: {
          setup(markdownit: any) {
            markdownit.use(parseMention(this.options.users, this.options.currentUser))
          },
        },
      },
    }
  },
})
