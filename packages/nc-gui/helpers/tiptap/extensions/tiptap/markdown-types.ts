import { Editor } from '@tiptap/core'
import { MarkdownSerializer, MarkdownSerializerState } from '@tiptap/pm/markdown'
import { Node, Mark } from '@tiptap/pm/model'
import MarkdownIt from 'markdown-it'

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

type SpecContext<Options> = {
  options: Options
  editor: Editor
}

export type MarkdownNodeSpec<O = any> = {
  serialize(this: SpecContext<O>, state: MarkdownSerializerState, node: Node, parent: Node, index: number): void
  parse?: {
    setup?(this: SpecContext<O>, markdownit: MarkdownIt): void
    updateDOM?(this: SpecContext<O>, element: HTMLElement): void
  }
}

export type MarkdownMarkSpec<O = any> = {
  serialize: (typeof MarkdownSerializer.prototype.marks)[string] & {
    open: string | ((this: SpecContext<O>, state: MarkdownSerializerState, mark: Mark, parent: Node, index: number) => string)
    close: string | ((this: SpecContext<O>, state: MarkdownSerializerState, mark: Mark, parent: Node, index: number) => string)
  }
  parse?: {
    setup?(this: SpecContext<O>, markdownit: MarkdownIt): void
    updateDOM?(this: SpecContext<O>, element: HTMLElement): void
  }
}
