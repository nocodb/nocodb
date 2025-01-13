import type { Editor } from '@tiptap/core'
import type { MarkdownSerializer, MarkdownSerializerState } from '@tiptap/pm/markdown'
import type { Mark, Node } from '@tiptap/pm/model'
import type MarkdownIt from 'markdown-it'

export interface MarkdownOptions {
  html?: boolean
  tightLists?: boolean
  tightListClass?: string
  bulletListMarker?: string
  linkify?: boolean
  breaks?: boolean
  transformPastedText?: boolean
  transformCopiedText?: boolean
}

export interface MarkdownStorage {
  options: MarkdownOptions
  getMarkdown(): string
}

interface SpecContext<Options> {
  options: Options
  editor: Editor
}

export interface MarkdownNodeSpec<O = any> {
  serialize(this: SpecContext<O>, state: MarkdownSerializerState, node: Node, parent: Node, index: number): void
  parse?: {
    setup?(this: SpecContext<O>, markdownit: MarkdownIt): void
    updateDOM?(this: SpecContext<O>, element: HTMLElement): void
  }
}

export interface MarkdownMarkSpec<O = any> {
  serialize: (typeof MarkdownSerializer.prototype.marks)[string] & {
    open: string | ((this: SpecContext<O>, state: MarkdownSerializerState, mark: Mark, parent: Node, index: number) => string)
    close: string | ((this: SpecContext<O>, state: MarkdownSerializerState, mark: Mark, parent: Node, index: number) => string)
  }
  parse?: {
    setup?(this: SpecContext<O>, markdownit: MarkdownIt): void
    updateDOM?(this: SpecContext<O>, element: HTMLElement): void
  }
}
