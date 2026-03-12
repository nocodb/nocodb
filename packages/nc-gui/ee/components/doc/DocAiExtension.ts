/**
 * TipTap extension that provides `editor.storage.docAi` for AI operations.
 *
 * Slash commands and bubble menu actions call methods on this storage object.
 * The extension bridges between the editor and the useDocumentAi composable,
 * inserting AI-generated content as Markdown → ProseMirror nodes.
 */
import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { marked } from 'marked'

export interface DocAiStorage {
  write: ((instruction: string) => Promise<void>) | null
  continueWriting: (() => Promise<void>) | null
  summarize: (() => Promise<void>) | null
  improve: ((mode: string) => Promise<void>) | null
  translate: ((targetLanguage: string) => Promise<void>) | null
  _pendingInstruction: string | null
  isLoading: boolean
}

export const DocAiExtension = Extension.create({
  name: 'docAi',

  addStorage() {
    return {
      write: null,
      continueWriting: null,
      summarize: null,
      improve: null,
      translate: null,
      _pendingInstruction: null,
      isLoading: false,
    } as DocAiStorage
  },
})

/**
 * Convert Markdown text to HTML and insert it at the current cursor.
 * TipTap's insertContent natively handles HTML parsing with proper schema awareness.
 */
export function insertMarkdownContent(editor: Editor, markdown: string) {
  const html = marked.parse(markdown, { async: false }) as string

  editor.chain().focus().insertContent(html).run()
}
