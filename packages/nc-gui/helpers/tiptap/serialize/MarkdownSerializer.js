import { MarkdownSerializerState } from './state'
import HTMLMark from '../extensions/marks/html'
import HTMLNode from '../extensions/nodes/html'
import { getMarkdownSpec } from '../util/extensions'
import HardBreak from '../extensions/nodes/hard-break'

export class MarkdownSerializer {
  /**
   * @type {import('@tiptap/core').Editor}
   */
  editor = null

  constructor(editor) {
    this.editor = editor
  }

  serialize(content) {
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

  serializeNode(node) {
    return getMarkdownSpec(node)?.serialize?.bind({ editor: this.editor, options: node.options })
  }

  serializeMark(mark) {
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
