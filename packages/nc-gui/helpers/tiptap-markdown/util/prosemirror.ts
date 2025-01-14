import type { Node } from '@tiptap/pm/model'

export function childNodes(node: Node) {
  return node?.content?.content ?? []
}
