import TiptapTableHeader from '@tiptap/extension-table-header'
import type { EditorState, Transaction } from 'prosemirror-state'
import { Plugin, PluginKey } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node } from 'prosemirror-model'
import { TableMap, removeColumn, selectedRect } from '@tiptap/prosemirror-tables'

const TableHeader = TiptapTableHeader.extend({
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tableHeader'),
        props: {
          decorations(state: EditorState) {
            const decorations: Decoration[] = []
            const { doc } = state

            let tableNode: Node | undefined
            let tablePos = 0
            doc.descendants((node: Node, pos: any) => {
              if (node.type.name === 'table') {
                tableNode = node
                tablePos = pos
              }
              if (node.type.name !== 'tableHeader') return

              if (tableNode?.firstChild?.childCount === 1) return

              // check if the node is on the first row
              const decorationTable = Decoration.node(pos, pos + node.nodeSize, {
                'class': '',
                'col-pos': pos.toString(),
              })

              const decorationDeleteRow = Decoration.widget(tablePos, (view: EditorView) => deleteColumnButton(view, pos))

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

function deleteColumnButton(view: EditorView, pos: number) {
  const deleteColumnButtonWrapper = document.createElement('div')
  deleteColumnButtonWrapper.setAttribute('tiptap-table-modify-column', pos.toString())
  deleteColumnButtonWrapper.setAttribute('class', 'flex flex-row justify-center absolute')
  deleteColumnButtonWrapper.style.left = '-1.5rem'
  deleteColumnButtonWrapper.style.width = '3rem'
  const deleteColumnButton = document.createElement('button')

  deleteColumnButton.setAttribute('class', 'flex bg-gray-100 my-1 rounded-sm')
  deleteColumnButton.style.paddingLeft = 'calc(50% - 2rem)'
  deleteColumnButton.style.paddingRight = 'calc(50% - 2rem)'
  deleteColumnButton.textContent = '-'

  deleteColumnButton.style.opacity = '0'
  deleteColumnButton.addEventListener('mouseover', () => {
    deleteColumnButton.style.opacity = '0.7'
  })
  deleteColumnButton.addEventListener('mouseout', () => {
    deleteColumnButton.style.opacity = '0'
  })

  deleteColumnButton.addEventListener('mousedown', () => {
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

    const map = TableMap.get(tableNode!)
    const currentNodeIndexInTableMap = map.map.indexOf(pos - 1)

    const rect = map.rectBetween(map.map[currentNodeIndexInTableMap], map.map[currentNodeIndexInTableMap])
    const columnInfo = { ...rect, bottom: rect.bottom, tableStart: tablePos, map, table: tableNode }

    deleteColumn(state, columnInfo, view.dispatch)
  })

  deleteColumnButtonWrapper.appendChild(deleteColumnButton)
  return deleteColumnButtonWrapper
}

export function deleteColumn(state: EditorState, columnInfo: any, dispatch?: (tr: Transaction) => void): boolean {
  if (dispatch) {
    const rect = columnInfo
    const tr = state.tr
    if (rect.left === 0 && rect.right === rect.map.width) return false
    for (let i = rect.right - 1; ; i--) {
      removeColumn(tr, rect, i)
      if (i === rect.left) break
      const table = rect.tableStart ? tr.doc.nodeAt(rect.tableStart - 1) : tr.doc
      if (!table) {
        throw new RangeError('No table found')
      }
      rect.table = table
      rect.map = TableMap.get(table)
    }
    dispatch(tr)
  }
  return true
}

export { TableHeader }
