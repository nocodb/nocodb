import Table from '@tiptap/extension-table'
import type { EditorState } from 'prosemirror-state'
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import type { DecorationSource, EditorView } from 'prosemirror-view'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node } from 'prosemirror-model'
import { TableMap, addColumn, addRow, columnResizing } from '@tiptap/prosemirror-tables'
import { TableNodeView } from './TableNodeView'

export default Table.extend({
  draggable: true,
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('table'),
        view() {
          return {
            update: async (view, prevState) => {
              // set createColumnButton height to the table height
              const createColumnButtons = document.querySelectorAll('[tiptap-table-create-column-id]')
              const tables = document.querySelectorAll('[data-placeholder="table"]')
              const tablesInner = document.querySelectorAll('[data-placeholder="table"] tbody')
              const prosemirrorWrapper = document.querySelector('.ProseMirror')
              if (!prosemirrorWrapper) return

              const prosemirrorWrapperY = prosemirrorWrapper.getBoundingClientRect().top

              if (createColumnButtons.length) {
                let index = 0
                createColumnButtons.forEach((createColumnButton: any) => {
                  const table = tablesInner[index]
                  if (table) {
                    createColumnButton.style.height = `${(table as any).offsetHeight}px`
                    createColumnButton.style.left = `${(table as any).offsetWidth + 5}px`
                    index += 1
                  }
                })
              }

              const createRowButtons = document.querySelectorAll('[tiptap-table-create-row-id]')
              if (createRowButtons.length) {
                let index = 0
                createRowButtons.forEach((createRowButton: any) => {
                  const table = tablesInner[index]
                  if (table) {
                    createRowButton.style.width = `${(table as any).offsetWidth + 1}px`
                    index += 1
                  }
                })
              }

              for (const table of tables) {
                const tableId = table.getAttribute('data-decoration-id')
                const tableY = table.getBoundingClientRect().top
                const headerDom = document.querySelector(`[data-decoration-id="${tableId}"] tr`)
                if (!headerDom) continue

                const anchorY = tableY - prosemirrorWrapperY + (headerDom ? headerDom.getBoundingClientRect().height : 0)

                const modifyColumnButtons = document.querySelectorAll(`[tiptap-table-modify-column-table-pos="${tableId}"]`)
                const colDoms = document.querySelectorAll(`[data-decoration-id="${tableId}"] [col-pos]`)

                let widthOffset = 0
                for (let i = 0; i < modifyColumnButtons.length; i++) {
                  const modifyColumnButton = modifyColumnButtons[i]
                  const colDom = colDoms[i]

                  if (modifyColumnButton && colDom) {
                    modifyColumnButton.style.left = `${widthOffset}px`
                    modifyColumnButton.style.top = `${anchorY - headerDom.clientHeight - 30}px`
                    // modifyColumnButton.style.height = `${36}px`
                    modifyColumnButton.style.width = `${(colDom as any).offsetWidth}px`
                    widthOffset = widthOffset + (colDom as any).offsetWidth
                  }
                }
              }

              // set modify column button
            },
          }
        },

        props: {
          decorations(state: EditorState) {
            const decorations: Decoration[] = []
            const { doc } = state

            doc.descendants((node: Node, pos: any) => {
              if (node.type.name !== 'table') return

              const decorationTable = Decoration.node(pos, pos + node.nodeSize, {
                'class': 'relative mt-4',
                'data-placeholder': 'table',
                'data-decoration-id': pos,
                'nodeName': 'div',
              })
              const createColumnDecoration = Decoration.widget(pos + 1, (view: EditorView, getPos: () => number | undefined) => {
                // console.log('widget', view, getPos())
                const createColumnDiv = document.createElement('div')
                createColumnDiv.className = 'absolute h-full tiptap-table-create-column'
                // Set html attributes to the div with the data-decoration-id
                createColumnDiv.attributes.setNamedItem(document.createAttribute('tiptap-table-create-column-id'))
                createColumnDiv.setAttribute('tiptap-table-create-column-id', `${pos}`)

                const createColumnButton = document.createElement('button')
                createColumnButton.className =
                  'px-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 top-0 -right-4 z-10  rounded-sm h-full'
                createColumnButton.innerHTML = '+'
                createColumnDiv.appendChild(createColumnButton)

                createColumnDiv.style.opacity = '0'
                createColumnDiv.addEventListener('mouseover', () => {
                  createColumnDiv.style.opacity = '0.7'
                })
                createColumnDiv.addEventListener('mouseout', () => {
                  createColumnDiv.style.opacity = '0'
                })

                createColumnButton.addEventListener('mousedown', () => {
                  const state = view.state
                  const tableNode = state.doc.nodeAt(pos)
                  const columnCount = tableNode?.child(0).childCount
                  const map = TableMap.get(tableNode!)
                  const rowInfo = { tableStart: pos, map, table: tableNode }

                  view.dispatch(addColumn(state.tr, rowInfo as any, columnCount!))
                })

                return createColumnDiv
              })

              const createRowDecoration = Decoration.widget(pos + node.nodeSize, (view: EditorView) => {
                const createRowDiv = document.createElement('div')
                createRowDiv.className = 'w-full mb-2 mt-1'
                // Set html attributes to the div with the data-decoration-id
                createRowDiv.attributes.setNamedItem(document.createAttribute('tiptap-table-create-row-id'))
                createRowDiv.setAttribute('tiptap-table-create-row-id', `${pos}`)

                const createRowButton = document.createElement('button')
                createRowButton.className = 'w-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-sm text-center'
                // set the height of the button to the height of the table
                // createRowButton.style.height = `${view.dom.querySelector(`[data-decoration-id="${pos}"]`)?.clientHeight}px`
                createRowButton.textContent = '+'
                createRowDiv.appendChild(createRowButton)

                createRowDiv.style.opacity = '0'
                createRowDiv.addEventListener('mouseover', () => {
                  createRowDiv.style.opacity = '0.7'
                })
                createRowDiv.addEventListener('mouseout', () => {
                  createRowDiv.style.opacity = '0'
                })

                createRowButton.addEventListener('mousedown', () => {
                  const state = view.state
                  const tableNode = state.doc.nodeAt(pos)

                  const posOfTableEnd = pos + tableNode?.nodeSize

                  // TODO: Simplify this
                  const lastCellNodePos = 1
                  const map = TableMap.get(tableNode!)
                  const rect = map.rectBetween(lastCellNodePos, lastCellNodePos)
                  const rowInfo = { ...rect, tableStart: posOfTableEnd - 1, map, table: tableNode }

                  view.dispatch(addRow(state.tr, rowInfo as any, 0))
                })

                return createRowDiv
              })

              decorations.push(createColumnDecoration)
              decorations.push(decorationTable)
              decorations.push(createRowDecoration)
            })

            return DecorationSet.create(doc, decorations) as DecorationSource
          },
        },
      }),
      columnResizing({
        handleWidth: this.options.handleWidth,
        cellMinWidth: this.options.cellMinWidth,
        View: this.options.View,
        // TODO: PR for @types/prosemirror-tables
        // @ts-expect-error (incorrect type)
        lastColumnResizable: this.options.lastColumnResizable,
      }),
    ]
  },
}).configure({
  HTMLAttributes: {
    class: '',
  },
  View: TableNodeView,
})
