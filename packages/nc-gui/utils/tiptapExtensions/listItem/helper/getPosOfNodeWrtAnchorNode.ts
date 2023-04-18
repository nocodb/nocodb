import type { EditorState } from 'prosemirror-state'

export function getPosOfNodeWrtAnchorNode({
  state,
  anchorPos,
  nodeType,
  possibleParentTypes,
  direction,
}: {
  state: EditorState
  anchorPos: number
  nodeType: string
  possibleParentTypes: string[]
  direction: 'before' | 'after'
}) {
  let pos = direction === 'before' ? 0 : Infinity
  state.doc.descendants((node, nodePos) => {
    const beforeCondition = nodePos > pos && nodePos < anchorPos
    const afterCondition = nodePos > anchorPos && nodePos < pos
    if (node.type.name === nodeType && (direction === 'before' ? beforeCondition : afterCondition)) {
      pos = nodePos
    }

    // console.log('node', node.type.name, node.textContent, nodePos)
    return possibleParentTypes.includes(node.type.name)
  })

  return pos
}
