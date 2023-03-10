import type { EditorState, Transaction } from 'prosemirror-state'
import type { Fragment } from 'prosemirror-model'

export const addPastedContentToTransaction = (transaction: Transaction, state: EditorState, fragments: Fragment[]) => {
  const { selection } = state

  const currentNodeIsEmpty = selection.$from.parent.textContent === ''

  for (const fragment of fragments) {
    transaction.insert(currentNodeIsEmpty ? selection.from - 1 : selection.from, fragment)
  }
}

export const getTextAsParagraphFromSliceJson = (sliceJson: any) => {
  // recursively get text from slice json
  const getText = (sliceJson: any, text: string) => {
    if (sliceJson.text) {
      text = text + sliceJson.text
    }

    if (sliceJson.content) {
      for (const content of sliceJson.content) {
        text = text + getText(content, text)
      }
    }

    return text
  }

  const text = getText(sliceJson, '')

  return {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text,
      },
    ],
  }
}
