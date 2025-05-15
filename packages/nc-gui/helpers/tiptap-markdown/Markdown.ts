import { Extension, extensions } from '@tiptap/core'
import { MarkdownSerializer } from './serialize'
import { MarkdownParser } from './parse'
import { MarkdownClipboard, MarkdownTightLists } from './extensions/tiptap'
import type { MarkdownOptions, MarkdownStorage } from './types'

export const Markdown = Extension.create<MarkdownOptions, MarkdownStorage>({
  name: 'markdown',
  priority: 50,
  addOptions() {
    return {
      html: true,
      tightLists: true,
      tightListClass: 'tight',
      bulletListMarker: '-',
      linkify: false,
      breaks: false,
      transformPastedText: false,
      transformCopiedText: false,
    }
  },
  addCommands() {
    const commands = extensions.Commands.config.addCommands()
    return {
      setContent: (content, emitUpdate, parseOptions) => (props) => {
        return commands.setContent(props.editor.storage.markdown.parser.parse(content), emitUpdate, parseOptions)(props)
      },
      insertContentAt: (range, content, options) => (props) => {
        return commands.insertContentAt(
          range,
          props.editor.storage.markdown.parser.parse(content, { inline: true }),
          options,
        )(props)
      },
    }
  },
  onBeforeCreate() {
    this.editor.storage.markdown = {
      options: { ...this.options },
      parser: new MarkdownParser(this.editor, this.options),
      serializer: new MarkdownSerializer(this.editor),
      getMarkdown: () => {
        const markdown = this.editor.storage.markdown.serializer.serialize(this.editor.state.doc)

        return markdown.replace(/<br \/>/g, '<br>')
      },
      getHtmlFromMd: (md) => {
        if (!md) return ''

        return this.editor.storage.markdown.parser.parse(md)
      },
    }
    this.editor.options.initialContent = this.editor.options.content
    this.editor.options.content = this.editor.storage.markdown.parser.parse(this.editor.options.content)
  },
  onCreate() {
    this.editor.options.content = this.editor.options.initialContent
    delete this.editor.options.initialContent
  },
  addStorage() {
    return {
      /// storage will be defined in onBeforeCreate() to prevent initial object overriding
    }
  },
  addExtensions() {
    return [
      MarkdownTightLists.configure({
        tight: this.options.tightLists,
        tightClass: this.options.tightListClass,
      }),
      MarkdownClipboard.configure({
        transformPastedText: this.options.transformPastedText,
        transformCopiedText: this.options.transformCopiedText,
      }),
    ]
  },
})
