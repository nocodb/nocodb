/**
 * Slash command ("/") extension for the doc editor.
 *
 * Typing "/" at the start of a line (or after a space) opens a Notion-style
 * command palette that lets users insert block types: headings, lists,
 * blockquotes, code blocks, tables, images, and horizontal rules.
 *
 * Built on top of @tiptap/suggestion which handles the trigger detection,
 * query filtering, and keyboard navigation plumbing.
 */
import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import type { Editor, Range } from '@tiptap/core'
import { createApp, ref, h } from 'vue'
import tippy from 'tippy.js'
import type { Instance as TippyInstance } from 'tippy.js'
import SlashCommandMenu from './SlashCommandMenu.vue'

export interface SlashCommandItem {
  title: string
  description: string
  icon: string
  group: string
  command: (editor: Editor, range: Range) => void
}

/**
 * All available slash commands. Each entry defines a title (shown in the menu),
 * a short description, an icon name (GeneralIcon), and the editor command to run.
 */
// Inline SVG icons — keeps the menu independent of Nuxt auto-imports
const svg = (d: string, vb = '0 0 24 24') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`

const icons = {
  h1: svg('<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12l3-2v8"/>'),
  h2: svg('<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/>'),
  h3: svg('<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/>'),
  bulletList: svg('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
  numberedList: svg('<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>'),
  quote: svg('<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/>'),
  code: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  table: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
  divider: svg('<line x1="5" y1="12" x2="19" y2="12"/>'),
  file: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>'),
  // Callout icons — black versions for slash menu (colored versions live in CalloutExtension)
  note: svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
  warning: svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  tip: svg('<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1-3c1.9.5 3.3 1.6 4.4 3.1a12.3 12.3 0 0 1 2 5.6c-2-.8-3.5-1.8-4.5-3.2a9 9 0 0 1-.8-2.5z"/>'),
  important: svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
}

export const slashCommandItems: SlashCommandItem[] = [
  // — Headings —
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: icons.h1,
    group: 'Headings',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: icons.h2,
    group: 'Headings',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: icons.h3,
    group: 'Headings',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
  },
  // — Lists —
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: icons.bulletList,
    group: 'Lists',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: icons.numberedList,
    group: 'Lists',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  // — Blocks —
  {
    title: 'Blockquote',
    description: 'Quote or callout',
    icon: icons.quote,
    group: 'Blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    title: 'Code Block',
    description: 'Fenced code block',
    icon: icons.code,
    group: 'Blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
  },
  {
    title: 'Table',
    description: '3×3 table with header row',
    icon: icons.table,
    group: 'Blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    },
  },
  {
    title: 'Image',
    description: 'Upload an image',
    icon: icons.image,
    group: 'Blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run()
      // Trigger file picker via the upload callback registered by Editor.vue
      editor.storage.image?.openUpload?.()
    },
  },
  {
    title: 'File attachment',
    description: 'Attach a file',
    icon: icons.file,
    group: 'Blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run()
      // Trigger file picker via the upload callback registered by Editor.vue
      editor.storage.fileAttachment?.openUpload?.()
    },
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: icons.divider,
    group: 'Blocks',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
  // — Callouts —
  {
    title: 'Note',
    description: 'Info callout',
    icon: icons.note,
    group: 'Callouts',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'note' }).run()
    },
  },
  {
    title: 'Warning',
    description: 'Warning callout',
    icon: icons.warning,
    group: 'Callouts',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'warning' }).run()
    },
  },
  {
    title: 'Tip',
    description: 'Tip callout',
    icon: icons.tip,
    group: 'Callouts',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'tip' }).run()
    },
  },
  {
    title: 'Important',
    description: 'Important callout',
    icon: icons.important,
    group: 'Callouts',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'important' }).run()
    },
  },
]

/**
 * Creates a Tiptap extension that registers the "/" suggestion plugin.
 *
 * Rendering uses Vue's `createApp` to mount `SlashCommandMenu.vue` into
 * a tippy.js popup anchored to the cursor position.
 */
export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }: { query: string }) => {
          return slashCommandItems.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase()),
          )
        },
        render: () => {
          let popup: TippyInstance | undefined
          let vueApp: ReturnType<typeof createApp> | undefined
          let menuRef: any = null

          // Reactive refs that the mounted Vue component reads
          const itemsRef = ref<SlashCommandItem[]>([])
          const commandRef = ref<((item: SlashCommandItem) => void) | null>(null)

          return {
            onStart: (props: any) => {
              itemsRef.value = props.items
              commandRef.value = props.command

              const el = document.createElement('div')

              // Mount SlashCommandMenu as a standalone Vue app
              vueApp = createApp({
                render() {
                  return h(SlashCommandMenu, {
                    items: itemsRef.value,
                    command: (item: SlashCommandItem) => commandRef.value?.(item),
                    ref: (ref: any) => { menuRef = ref },
                  })
                },
              })
              vueApp.mount(el)

              if (!props.clientRect) return

              popup = tippy(document.body, {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: el,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                animation: false,
                maxWidth: 320,
              })
            },

            onUpdate: (props: any) => {
              itemsRef.value = props.items
              commandRef.value = props.command
              if (popup && props.clientRect) {
                popup.setProps({ getReferenceClientRect: props.clientRect })
              }
            },

            onKeyDown: (props: any) => {
              if (props.event.key === 'Escape') {
                popup?.hide()
                return true
              }
              return menuRef?.onKeyDown?.(props.event) || false
            },

            onExit: () => {
              popup?.destroy()
              vueApp?.unmount()
              popup = undefined
              vueApp = undefined
              menuRef = null
            },
          }
        },
        command: ({ editor, range, props: item }: { editor: Editor; range: Range; props: SlashCommandItem }) => {
          item.command(editor, range)
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
