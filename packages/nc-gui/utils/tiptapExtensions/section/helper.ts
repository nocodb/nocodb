import type { EditorState } from 'prosemirror-state'

export function selectSectionsInTextSelection(state: EditorState) {
  const { selection } = state

  const { from: _from, to } = selection
  const from = _from === 2 ? 0 : _from

  const sectionDoms = document.querySelectorAll('.ProseMirror .draggable-block-wrapper')
  for (let i = 0; i < sectionDoms.length; i++) {
    const pos = Number(sectionDoms[i].getAttribute('pos'))
    if (from <= pos && pos < to && !selection.empty) {
      setTimeout(() => {
        sectionDoms[i].classList.add('selected')
      }, 0)
      continue
    }

    sectionDoms[i].classList.remove('selected')
  }

  return false
}
