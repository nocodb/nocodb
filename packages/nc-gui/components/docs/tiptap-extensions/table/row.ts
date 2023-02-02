import TiptapTableRow from '@tiptap/extension-table-row'
import type { EditorState, Transaction } from 'prosemirror-state'
import { Plugin, PluginKey } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node } from 'prosemirror-model'
import { TableMap, removeRow } from '@tiptap/prosemirror-tables'

const TableRow = TiptapTableRow.extend({
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tableRow'),

        props: {
          decorations(state: EditorState) {
            const decorations: Decoration[] = []
            const { doc } = state

            let tableNode: Node | undefined

            doc.descendants((node: Node, pos: any) => {
              if (node.type.name === 'table') tableNode = node
              if (node.type.name !== 'tableRow') return
              if (node.firstChild?.type.name === 'tableHeader') return

              if (tableNode?.childCount === 2) return

              // check if the node is on the first row
              const decorationTable = Decoration.node(pos, pos + node.nodeSize, {
                'class': '',
                'row-pos': pos.toString(),
              })

              const decorationDeleteRow = Decoration.widget(pos + 2, (view: EditorView) => deleteRowButton(view, pos))

              decorations.push(decorationDeleteRow)
              decorations.push(decorationTable)
            })
            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})

function deleteRowButton(view: EditorView, pos: number) {
  const deleteRowButtonWrapper = document.createElement('div')
  deleteRowButtonWrapper.setAttribute('tiptap-table-modify-row', pos.toString())
  deleteRowButtonWrapper.setAttribute('class', 'flex flex-row justify-center absolute')
  deleteRowButtonWrapper.style.left = '-1.5rem'
  deleteRowButtonWrapper.style.width = '1rem'
  const deleteRowButton = document.createElement('button')

  deleteRowButton.setAttribute('class', 'flex absolute bg-gray-100 my-1 px-2 rounded-md')
  deleteRowButton.textContent = '-'

  deleteRowButton.style.opacity = '0'
  deleteRowButton.addEventListener('mouseover', () => {
    deleteRowButton.style.opacity = '0.7'
  })
  deleteRowButton.addEventListener('mouseout', () => {
    deleteRowButton.style.opacity = '0'
  })

  deleteRowButton.addEventListener('mousedown', () => {
    const state = view.state
    // find nearest table node

    const currentNode = state.doc.nodeAt(pos)
    let tableNode: Node | undefined
    let tableFound = false
    let tablePos = 0
    state.doc.descendants((node: Node, pos: number) => {
      if (!tableFound && node.type.name === 'table') {
        tableNode = node
        tablePos = pos
      }

      if (pos > currentNode?.pos) {
        tableFound = true
      }
    })

    // TODO: Simplify this
    const map = TableMap.get(tableNode!)
    const currentNodeIndexInTableMap = map.map.indexOf(pos)
    const lastCellInRowTableMapIndex = currentNodeIndexInTableMap + map.width - 1

    const rect = map.rectBetween(map.map[currentNodeIndexInTableMap], map.map[lastCellInRowTableMapIndex])
    const rowInfo = { ...rect, bottom: rect.bottom, tableStart: tablePos, map, table: tableNode }

    deleteRow(state, rowInfo, view.dispatch)
  })

  deleteRowButtonWrapper.appendChild(deleteRowButton)
  return deleteRowButtonWrapper
}

export function deleteRow(state: EditorState, rowInfo: any, dispatch?: (tr: Transaction) => void): boolean {
  if (dispatch) {
    const tr = state.tr
    const rect = rowInfo
    if (rect.top === 0 && rect.bottom === rect.map.height) return false

    for (let i = rect.bottom - 1; ; i--) {
      removeRow(tr, rowInfo, i)
      if (i === rect.top) break
      const table = rect.tableStart ? tr.doc.nodeAt(rect.tableStart - 1) : tr.doc
      if (!table) {
        throw new RangeError('No table found')
      }
      rect.table = table
      rect.map = TableMap.get(rect.table)
    }
    dispatch(tr)
  }
  return true
}

export { TableRow }
