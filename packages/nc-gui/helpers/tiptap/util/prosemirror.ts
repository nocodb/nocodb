import { Node } from 'prosemirror-model'

export function childNodes(node: Node) {
  return node?.content?.content ?? []
}
