import { PasteRule } from '@tiptap/core'
import type { ListNodeType } from '.'

/**
 * Paste rule for list item. Converts pasted text or typed text to list item
 * @param nodeType
 * @param inputRegex Regex for detecting start of list item while typing. i.e '- ' for bullet list
 * @param pasteRegex Regex for detecting start of list item while pasting. i.e '- Content' for bullet list
 * @returns
 */
export const listItemPasteRule = ({
  nodeType,
  pasteRegex,
  inputRegex,
}: {
  nodeType: ListNodeType
  pasteRegex: RegExp
  inputRegex: RegExp
}) => {
  return new PasteRule({
    find: (text) => {
      return text.match(pasteRegex)?.map((matched, index) => {
        return {
          text: matched,
          index,
          data: { matched },
          start: index,
          end: index + matched.length,
        }
      })
    },
    // Called for each match
    handler({ match, chain, range, state }) {
      // If pasted on empty sec
      const currentSectionPos = getPositionOfSection(state, range.from)

      range.from = currentSectionPos

      // Set attrs for list item, i.e. order number for ordered list, checked for task list
      let orderNumber = 1
      if (nodeType === 'ordered') {
        orderNumber = Number(match[0].trimStart().split('.')[0])
      }

      let isChecked = false
      if (nodeType === 'task') {
        isChecked = match[0].trimStart().replace(' ', '').startsWith('-[x]')
        isChecked = isChecked || match[0].trimStart().replace(' ', '').startsWith('-[X]')
        isChecked = isChecked || match[0].trimStart().replace(' ', '').startsWith('[x]')
        isChecked = isChecked || match[0].trimStart().replace(' ', '').startsWith('[X]')
      }

      const attrs = {} as any
      if (nodeType === 'ordered') {
        attrs.number = String(orderNumber)
      }
      if (nodeType === 'task') {
        attrs.checked = isChecked
      }

      // Insert list item
      chain()
        .deleteRange(range)
        .insertContentAt(currentSectionPos, {
          type: 'sec',
          content: [
            {
              type: nodeType,
              attrs,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: match[0].replace(inputRegex, ''),
                    },
                  ],
                },
              ],
            },
          ],
        })
    },
  })
}
