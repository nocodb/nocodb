import TipTapMention, { type MentionNodeAttrs, type MentionOptions } from '@tiptap/extension-mention'
import type MarkdownIt from 'markdown-it'
import regexp from 'markdown-it-regexp'
import type { UserType } from 'nocodb-sdk'
import type { MarkdownNodeSpec } from '../../../../types'

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

    let className = 'mention'
    if (bUser.id === currentUser?.id) {
      className += ' nc-current-user'
    }

    return `<span class="${className}" data-id='${JSON.stringify({
      id: bUser?.id,
      email: bUser?.email,
      name: bUser?.display_name ?? '',
      isSameUser: bUser?.id === currentUser?.id,
    })}'  data-type="mention">${isReadonly ? '<span>@</span>' : '@'}${processedContent}</span>`
  })
}

export const UserMention = TipTapMention.extend<MentionOptions<any, MentionNodeAttrs>, { markdown: MarkdownNodeSpec }>({
  addOptions() {
    return {
      ...this.parent?.(),
      users: [],
      currentUser: {},
    }
  },
  // Override default addAttributes to fix copy-paste corruption.
  // The default `renderHTML` sets `data-id` to the raw JS object, which the browser
  // stringifies as "[object Object]". On paste, parseHTML reads that back as a string,
  // permanently corrupting the mention. Explicitly JSON.stringify on render and
  // parseProp on parse to preserve the object through the HTML round-trip.
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          return parseProp(element.getAttribute('data-id'))
        },
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.id) return {}

          return {
            'data-id': ncIsObject(attributes.id) ? JSON.stringify(attributes.id) : attributes.id,
          }
        },
      },
      label: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-label'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.label) return {}

          return { 'data-label': attributes.label }
        },
      },
    }
  },
  renderHTML({ HTMLAttributes }) {
    const attributes = parseProp(HTMLAttributes['data-id'])

    // Guard against corrupted mention data (e.g. id stored as "[object Object]" string).
    // parseProp returns the raw string if it can't parse JSON, so attributes may not be
    // an object. Fallback to empty string to avoid passing undefined to ProseMirror's
    // renderSpec, which would crash with "Cannot read properties of undefined (reading 'nodeType')".
    const innerText = ncIsObject(attributes)
      ? (attributes.name && attributes.name.length > 0 ? attributes.name : attributes.email) || ''
      : ''

    const styles =
      ncIsObject(attributes) && (attributes.isSameUser === true || attributes.isSameUser === 'true') ? 'nc-current-user' : ''

    return [
      'span',
      {
        'class': `mention ${styles}`,
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
          const user = parseProp(node.attrs.id)

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
