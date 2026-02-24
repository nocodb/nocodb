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
  // Embed icons — colored brand logos (raw SVG, no stroke helper)
  youtube: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#FF0000"/><polygon points="7 5.5 13 9 7 12.5" fill="white"/></svg>`,
  vimeo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#1AB7EA"/><path d="M13.5 7.2c-.05 1.1-.82 2.6-2.3 4.52-1.53 2-2.83 3-3.9 3-.66 0-1.22-.61-1.67-1.83l-.91-3.35c-.34-1.22-.7-1.83-1.08-1.83-.08 0-.37.17-.87.52l-.52-.67c.55-.48 1.09-.97 1.62-1.45.73-.63 1.27-.96 1.64-.99.86-.08 1.39.51 1.59 1.77.22 1.36.37 2.2.45 2.53.25 1.14.53 1.71.83 1.71.23 0 .59-.37 1.06-1.1.47-.74.72-1.3.75-1.69.07-.64-.18-.96-.75-.96-.27 0-.54.06-.82.18.54-1.78 1.58-2.65 3.12-2.6 1.14.04 1.68.78 1.62 2.22z" fill="white"/></svg>`,
  loom: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#625DF5"/><circle cx="9" cy="9" r="2.5" fill="white"/><rect x="8.25" y="2.5" width="1.5" height="4" rx=".75" fill="white"/><rect x="8.25" y="11.5" width="1.5" height="4" rx=".75" fill="white"/><rect x="2.5" y="8.25" width="4" height="1.5" rx=".75" fill="white"/><rect x="11.5" y="8.25" width="4" height="1.5" rx=".75" fill="white"/></svg>`,
  spotify: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#1DB954"/><path d="M12.8 8c-2.2-1.3-5.8-1.4-7.9-.8-.3.1-.7-.1-.8-.4-.1-.3.1-.7.4-.8 2.4-.7 6.4-.6 8.9.9.3.2.4.6.2.9-.2.2-.5.3-.8.1z" fill="white"/><path d="M12 10c-1.8-1.1-4.6-1.4-6.7-.8-.3.1-.6-.1-.7-.3-.1-.3.1-.6.3-.7 2.5-.8 5.5-.4 7.6.9.3.2.3.5.2.7-.2.2-.5.3-.7.2z" fill="white"/><path d="M11.1 11.9c-1.5-.9-3.3-1.1-5.5-.6-.2.1-.4 0-.5-.2s0-.4.2-.5c2.4-.5 4.4-.3 6.1.7.2.1.3.4.1.6-.1.1-.3.1-.4 0z" fill="white"/></svg>`,
  soundcloud: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#FF5500"/><path d="M3 12.5v-2M4.5 13v-3.5M6 13V8M7.5 13.5V7M9 13V8M10.5 13V7.5M12 13V7c1.5 0 3.5.8 3.5 3s-2 3-3.5 3z" stroke="white" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>`,
  figma: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#1E1E1E"/><path d="M7.25 4h2.25v3H7.25a1.5 1.5 0 0 1 0-3z" fill="#F24E1E"/><path d="M9.5 4h2.25a1.5 1.5 0 0 1 0 3H9.5V4z" fill="#FF7262"/><path d="M9.5 7h2.25a1.5 1.5 0 0 1 0 3H9.5V7z" fill="#1ABCFE"/><path d="M7.25 7H9.5v3H7.25a1.5 1.5 0 0 1 0-3z" fill="#A259FF"/><path d="M7.25 10H9.5v1.5a1.5 1.5 0 0 1-1.5 1.5h-.75v0a1.5 1.5 0 0 1 0-3z" fill="#0ACF83"/></svg>`,
  google: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="white" stroke="#e5e7eb" stroke-width=".5"/><path d="M14.76 9.18c0-.44-.04-.86-.11-1.27H9.18v2.4h3.13a2.68 2.68 0 0 1-1.16 1.76v1.46h1.88c1.1-1.01 1.73-2.5 1.73-4.35z" fill="#4285F4"/><path d="M9.18 14.76c1.57 0 2.89-.52 3.85-1.41l-1.88-1.46c-.52.35-1.19.56-1.97.56-1.51 0-2.8-1.02-3.25-2.4H4v1.5a5.82 5.82 0 0 0 5.18 3.21z" fill="#34A853"/><path d="M5.93 10.05A3.5 3.5 0 0 1 5.75 9c0-.36.06-.72.18-1.05V6.45H4a5.82 5.82 0 0 0 0 5.1l1.93-1.5z" fill="#FBBC05"/><path d="M9.18 5.55c.85 0 1.62.29 2.22.87l1.66-1.67A5.57 5.57 0 0 0 9.18 3.24 5.82 5.82 0 0 0 4 6.45l1.93 1.5c.46-1.38 1.74-2.4 3.25-2.4z" fill="#EA4335"/></svg>`,
  googleDrive: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="white" stroke="#e5e7eb" stroke-width=".5"/><path d="M3.5 12.5l2.7-4.7L9 3.5l2.8 4.3-2.7 4.7z" fill="#FBBC05"/><path d="M9 3.5l2.8 4.3h5.7L14.7 3.5z" fill="#34A853"/><path d="M6.2 7.8L3.5 12.5h5.4l2.7-4.7z" fill="#4285F4"/><path d="M11.8 7.8h5.7l-2.8 4.7H9.1z" fill="#34A853" opacity=".6"/><path d="M9 3.5L6.2 7.8l2.7 4.7z" fill="#EA4335" opacity=".6"/><path d="M3.5 12.5h5.4l2.9 2H5.5z" fill="#FBBC05" opacity=".6"/></svg>`,
  twitter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#000"/><path d="M10.17 8.24L13.48 4.5h-.92L9.77 7.63 7.44 4.5H4.5l3.47 5.05L4.5 13.5h.92l3.03-3.53L10.92 13.5H13.5l-3.33-5.26zm-1.07 1.25l-.35-.5-2.8-4h1.2l2.26 3.23.35.5 2.94 4.21h-1.2l-2.4-3.43z" fill="white"/></svg>`,
  codepen: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#1E1E1E"/><path d="M9 3.5l5.5 3.25v4.5L9 14.5l-5.5-3.25v-4.5L9 3.5zm0 4.25L5 10.25M9 7.75l4 2.5M9 14.5v-4.25M9 3.5v4.25M3.5 6.75l5.5 3.5 5.5-3.5M3.5 11.25l5.5-3.5 5.5 3.5" stroke="white" stroke-width=".8" fill="none"/></svg>`,
  github: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#24292f"/><path d="M9 3.5a5.5 5.5 0 0 0-1.74 10.72c.28.05.38-.12.38-.26v-.93c-1.54.34-1.87-.74-1.87-.74a1.47 1.47 0 0 0-.62-.81c-.5-.34.04-.34.04-.34a1.17 1.17 0 0 1 .85.57 1.19 1.19 0 0 0 1.62.46 1.18 1.18 0 0 1 .35-.74c-1.23-.14-2.52-.62-2.52-2.74a2.14 2.14 0 0 1 .57-1.49 2 2 0 0 1 .05-1.47s.47-.15 1.53.57a5.28 5.28 0 0 1 2.8 0c1.06-.72 1.53-.57 1.53-.57a2 2 0 0 1 .05 1.47 2.14 2.14 0 0 1 .57 1.49c0 2.13-1.3 2.6-2.53 2.74a1.33 1.33 0 0 1 .38 1.03v1.53c0 .18.1.32.38.26A5.5 5.5 0 0 0 9 3.5z" fill="white"/></svg>`,
  behance: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#1769FF"/><path d="M4 7h2.5c.83 0 1.5.45 1.5 1.25S7.33 9.5 6.5 9.5H4V7zm0 2.5h2.7c.91 0 1.55.5 1.55 1.38 0 .87-.64 1.37-1.55 1.37H4V9.5z" stroke="white" stroke-width=".6" fill="none"/><path d="M10.5 10.5c0-1.65.9-3 2.5-3s2.5 1.35 2.5 3h-4c.1.95.6 1.5 1.5 1.5.6 0 1-.25 1.2-.7h1.2c-.3 1.1-1.2 1.7-2.4 1.7-1.6 0-2.5-1.35-2.5-3v-.5zm1.1-.25h2.8c-.1-.85-.6-1.4-1.4-1.4s-1.3.55-1.4 1.4z" fill="white"/><path d="M11 6h3" stroke="white" stroke-width=".8" stroke-linecap="round"/></svg>`,
  dailymotion: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#0062FF"/><path d="M6 5h1.8v2.6l-.1 1c.4-.6 1.2-1.1 2.2-1.1 1.8 0 3.1 1.5 3.1 3.4s-1.3 3.6-3.2 3.6c-1 0-1.7-.4-2.1-1v.9H6V5zm3.5 3c-1.1 0-1.8.8-1.8 1.9s.7 2 1.8 2 1.8-.9 1.8-2-.7-1.9-1.8-1.9z" fill="white"/></svg>`,
  notion: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#fff" stroke="#e5e7eb" stroke-width=".5"/><path d="M5 4.5l1.5.12c.5.04.6.06.9-.18L8 4h5.5l.5.5v8.3c0 .4-.1.6-.6.63L8 13.7c-.37.02-.54-.04-.73-.28L5.8 11.5V5.3c0-.47.02-.72-.8-.8zm2.1.9v5.5l1.3 1.7h4.5V5.2L8.4 5.4c-.2.1-.3.06-.5-.1L7.1 5.4z" fill="#000"/><path d="M7 7h3.5M7 8.5h3.5M7 10h2" stroke="#000" stroke-width=".5" stroke-linecap="round"/></svg>`,
  ted: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#E62B1E"/><text x="9" y="12" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="7" font-weight="900" fill="white" letter-spacing=".5">TED</text></svg>`,
  jsfiddle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#0084FF"/><path d="M4 10.5c0-2 2.2-3.5 5-3.5s5 1.5 5 3.5-2.2 3.5-5 3.5-5-1.5-5-3.5z" stroke="white" stroke-width="1" fill="none"/><path d="M6.5 10.5c.5.8 1.3 1 2 .5M9.5 10.5c.5.8 1.3 1 2 .5" stroke="white" stroke-width=".8" stroke-linecap="round" fill="none"/></svg>`,
  stackblitz: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#1389FD"/><polygon points="10 3 5 10 8.5 10 8 15 13 8 9.5 8 10 3" fill="white"/></svg>`,
  codesandbox: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#151515"/><path d="M14 11.5V6.5L9 3.5 4 6.5v5l5 3 5-3z" stroke="white" stroke-width=".8" fill="none"/><path d="M4 6.5l5 3 5-3M9 9.5v5.5M6.5 5l5 3" stroke="white" stroke-width=".8" fill="none"/></svg>`,
  nocodb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><rect width="18" height="18" rx="4" fill="#1348BA"/><path d="M5 6.5L9 4l4 2.5v5L9 14l-4-2.5v-5z" stroke="white" stroke-width="1" fill="none"/><path d="M9 4v10M5 6.5L13 11.5M13 6.5L5 11.5" stroke="white" stroke-width=".7" opacity=".5"/></svg>`,
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
    { title: 'NocoDB View', description: 'Embed a shared NocoDB view', icon: icons.nocodb, placeholder: 'Paste a NocoDB shared view link...' },
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
