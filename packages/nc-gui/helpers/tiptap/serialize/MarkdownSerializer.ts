import type { Editor, AnyExtension } from '@tiptap/core'
import prosemirror from 'prosemirror-model'
import { MarkdownSerializerState } from './state'
import { HTMLMark, HTMLNode, HardBreak } from '../extensions'
import { getMarkdownSpec } from '../util/extensions'

export class MarkdownSerializer {
  editor: Editor

  constructor(editor: Editor) {
    this.editor = editor
  }

  serialize(content: prosemirror.Node) {
    const state = new MarkdownSerializerState(this.nodes, this.marks, {
      hardBreakNodeName: HardBreak.name,
    })

    state.renderContent(content)

    return state.out
  }

  get nodes() {
    return {
      ...Object.fromEntries(Object.keys(this.editor.schema.nodes).map((name) => [name, this.serializeNode(HTMLNode)])),
      ...Object.fromEntries(
        this.editor.extensionManager.extensions
          .filter((extension) => extension.type === 'node' && this.serializeNode(extension))
          .map((extension) => [extension.name, this.serializeNode(extension)]) ?? [],
      ),
    }
  }

  get marks() {
    return {
      ...Object.fromEntries(Object.keys(this.editor.schema.marks).map((name) => [name, this.serializeMark(HTMLMark)])),
      ...Object.fromEntries(
        this.editor.extensionManager.extensions
          .filter((extension) => extension.type === 'mark' && this.serializeMark(extension))
          .map((extension) => [extension.name, this.serializeMark(extension)]) ?? [],
      ),
    }
  }

  serializeNode(node: AnyExtension) {
    return getMarkdownSpec(node)?.serialize?.bind({ editor: this.editor, options: node.options })
  }

  serializeMark(mark: AnyExtension) {
    const serialize = getMarkdownSpec(mark)?.serialize
    return serialize
      ? {
          ...serialize,
          open:
            typeof serialize.open === 'function'
              ? serialize.open.bind({ editor: this.editor, options: mark.options })
              : serialize.open,
          close:
            typeof serialize.close === 'function'
              ? serialize.close.bind({ editor: this.editor, options: mark.options })
              : serialize.close,
        }
      : null
  }
}
