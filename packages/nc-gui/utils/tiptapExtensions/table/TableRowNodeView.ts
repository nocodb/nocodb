import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { NodeView } from 'prosemirror-view'

class TableRowNodeView implements NodeView {
  node: ProseMirrorNode

  dom: Element

  contentDOM: Element

  constructor(node: ProseMirrorNode) {
    this.node = node
    this.dom = document.createElement('tr')
    this.dom.className = 'tableWrapper'
    this.contentDOM = this.dom
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) {
      return false
    }

    this.node = node

    return true
  }
}

export { TableRowNodeView }
