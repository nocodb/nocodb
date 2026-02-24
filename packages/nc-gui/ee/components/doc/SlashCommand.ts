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
  /** When true, the menu shows an inline input instead of executing immediately */
  requiresInput?: boolean
  /** Placeholder text for the inline input (used when requiresInput is true) */
  inputPlaceholder?: string
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
  // Date/time icons
  calendar: svg('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
  clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  calendarClock: svg('<path d="M3 10h18"/><path d="M16 2v4"/><path d="M8 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M12 14l2 2 2-2"/><path d="M12 10v4"/>'),
  // Embed icons
  youtube: svg('<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" stroke="none"/>'),
  vimeo: svg('<path d="M21.99 5.13c-.1 2.1-1.56 4.97-4.38 8.62C14.7 17.55 12.26 19 10.26 19c-1.24 0-2.29-1.15-3.15-3.44l-1.72-6.3C4.7 6.95 3.95 5.8 3.14 5.8c-.16 0-.7.33-1.64.98L.5 5.55c1.03-.91 2.05-1.82 3.04-2.73C4.78 1.73 5.82 1.15 6.6 1.08c1.35-.13 2.18.79 2.5 2.77.34 2.14.58 3.47.71 3.98.4 1.79.83 2.69 1.3 2.69.37 0 .92-.58 1.65-1.73.73-1.16 1.12-2.04 1.17-2.64.1-1-.29-1.5-1.17-1.5-.42 0-.85.1-1.29.28.86-2.81 2.5-4.18 4.93-4.1 1.8.05 2.65 1.22 2.55 3.51z"/>'),
  loom: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="22"/><line x1="2" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="22" y2="12"/>'),
  spotify: svg('<circle cx="12" cy="12" r="10"/><path d="M8 15c3-1 6-.8 9 .5" stroke-width="1.5"/><path d="M7 12.5c3.5-1.2 7.5-1 11 .8" stroke-width="1.5"/><path d="M6.5 9.8c4-1.3 9-1.1 13 1" stroke-width="1.5"/>'),
  soundcloud: svg('<path d="M3 16v-4"/><path d="M6 16v-6"/><path d="M9 16V8"/><path d="M12 16V6"/><path d="M15 16V8"/><path d="M18 16v-4"/><path d="M21 16v-2"/>'),
  figma: svg('<path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"/><path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"/><path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z"/><path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"/><path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"/>'),
  google: svg('<path d="M12 11v4h6.3c-.5 2.5-2.8 4.5-6.3 4.5a7 7 0 1 1 4.5-12.4l2.9-2.9A11 11 0 1 0 12 23c6.3 0 10.5-4.4 10-11h-10z" fill="none"/>'),
  googleDrive: svg('<path d="M8 21l-4-7h16l-4 7H8z"/><path d="M12 3l8 14H4l8-14z"/><path d="M15.5 10L20 17"/><path d="M8.5 10L4 17"/>'),
  twitter: svg('<path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>'),
  codepen: svg('<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/><polyline points="2 15.5 12 8.5 22 15.5"/><line x1="12" y1="2" x2="12" y2="8.5"/>'),
  github: svg('<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>'),
  behance: svg('<path d="M1 12.5c0 0 2-4.5 6-4.5s6 4.5 6 4.5-2 4.5-6 4.5S1 12.5 1 12.5z"/><path d="M11 12.5c0 0 2-4.5 6-4.5s6 4.5 6 4.5-2 4.5-6 4.5-6-4.5-6-4.5z"/><circle cx="7" cy="12.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="17" cy="12.5" r="1.5" fill="currentColor" stroke="none"/>'),
  dailymotion: svg('<polygon points="5 3 19 12 5 21 5 3" fill="none"/>'),
  notion: svg('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 10h8"/><path d="M8 14h4"/>'),
  ted: svg('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M8 10h8" stroke-width="2.5"/>'),
  jsfiddle: svg('<path d="M4 15c0-3.3 3.6-6 8-6s8 2.7 8 6"/><path d="M4 15c0 3.3 3.6 6 8 6s8-2.7 8-6"/><path d="M12 9V3"/>'),
  stackblitz: svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="none"/>'),
  codesandbox: svg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="7.5 4.21 12 6.81 16.5 4.21"/><polyline points="7.5 19.79 7.5 14.6 3 12"/><polyline points="21 12 16.5 14.6 16.5 19.79"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
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
  // — Date & Time —
  {
    title: 'Current date',
    description: 'Insert today\'s date',
    icon: icons.calendar,
    group: 'Date & Time',
    command: (editor, range) => {
      const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      editor.chain().focus().deleteRange(range).insertContent(date).run()
    },
  },
  {
    title: 'Current time',
    description: 'Insert current time',
    icon: icons.clock,
    group: 'Date & Time',
    command: (editor, range) => {
      const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      editor.chain().focus().deleteRange(range).insertContent(time).run()
    },
  },
  {
    title: 'Current date and time',
    description: 'Insert date and time',
    icon: icons.calendarClock,
    group: 'Date & Time',
    command: (editor, range) => {
      const dt = new Date()
      const date = dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      editor.chain().focus().deleteRange(range).insertContent(`${date} ${time}`).run()
    },
  },
  // — Embeds —
  ...embedCommands(),
]

/** Helper: generates embed slash command entries — all share the same command logic. */
function embedCommands(): SlashCommandItem[] {
  const embeds: { title: string; description: string; icon: string; placeholder: string }[] = [
    { title: 'YouTube', description: 'Embed a YouTube video', icon: icons.youtube, placeholder: 'Paste a YouTube link...' },
    { title: 'Vimeo', description: 'Embed a Vimeo video', icon: icons.vimeo, placeholder: 'Paste a Vimeo link...' },
    { title: 'Loom', description: 'Embed a Loom recording', icon: icons.loom, placeholder: 'Paste a Loom link...' },
    { title: 'Spotify', description: 'Embed a Spotify track or playlist', icon: icons.spotify, placeholder: 'Paste a Spotify link...' },
    { title: 'SoundCloud', description: 'Embed a SoundCloud track', icon: icons.soundcloud, placeholder: 'Paste a SoundCloud link...' },
    { title: 'Figma', description: 'Embed a Figma design', icon: icons.figma, placeholder: 'Paste a Figma link...' },
    { title: 'Google Docs', description: 'Embed a Google Doc, Sheet, or Slide', icon: icons.google, placeholder: 'Paste a Google Docs link...' },
    { title: 'Google Drive', description: 'Embed a Google Drive folder', icon: icons.googleDrive, placeholder: 'Paste a Google Drive link...' },
    { title: 'Twitter / X', description: 'Embed a tweet', icon: icons.twitter, placeholder: 'Paste a Twitter / X link...' },
    { title: 'CodePen', description: 'Embed a CodePen', icon: icons.codepen, placeholder: 'Paste a CodePen link...' },
    { title: 'GitHub Gist', description: 'Embed a GitHub Gist', icon: icons.github, placeholder: 'Paste a Gist link...' },
    { title: 'Behance', description: 'Embed a Behance project', icon: icons.behance, placeholder: 'Paste a Behance link...' },
    { title: 'Dailymotion', description: 'Embed a Dailymotion video', icon: icons.dailymotion, placeholder: 'Paste a Dailymotion link...' },
    { title: 'Notion', description: 'Embed a Notion page', icon: icons.notion, placeholder: 'Paste a Notion link...' },
    { title: 'TED', description: 'Embed a TED talk', icon: icons.ted, placeholder: 'Paste a TED link...' },
    { title: 'JSFiddle', description: 'Embed a JSFiddle', icon: icons.jsfiddle, placeholder: 'Paste a JSFiddle link...' },
    { title: 'StackBlitz', description: 'Embed a StackBlitz project', icon: icons.stackblitz, placeholder: 'Paste a StackBlitz link...' },
    { title: 'CodeSandbox', description: 'Embed a CodeSandbox', icon: icons.codesandbox, placeholder: 'Paste a CodeSandbox link...' },
  ]

  return embeds.map((e) => ({
    title: e.title,
    description: e.description,
    icon: e.icon,
    group: 'Embeds',
    requiresInput: true,
    inputPlaceholder: e.placeholder,
    command: (editor: Editor, range: Range) => {
      editor.chain().focus().deleteRange(range).run()
      const url = editor.storage.embed?._pendingUrl
      if (url) {
        editor.storage.embed._pendingUrl = null
        editor.storage.embed?.insertFromUrl?.(editor, url)
      }
    },
  }))
}

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
              // Delegate to the menu first — in input mode it handles
              // Enter/Escape internally (e.g. Escape cancels input, not the popup)
              if (menuRef?.onKeyDown?.(props.event)) return true

              if (props.event.key === 'Escape') {
                popup?.hide()
                return true
              }
              return false
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
