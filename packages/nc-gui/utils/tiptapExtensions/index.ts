import Underline from '@tiptap/extension-underline'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import DropCursor from '@tiptap/extension-dropcursor'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Strike from '@tiptap/extension-strike'
import Code from '@tiptap/extension-code'
import CodeBlock from '@tiptap/extension-code-block'
import Blockquote from '@tiptap/extension-blockquote'
import HardBreak from '@tiptap/extension-hard-break'
import type { Extensions } from '@tiptap/core'
import { Bullet } from './listItem/bullet'
import { Ordered } from './listItem/ordered'
import { Task } from './listItem/task'
import { HorizontalRule } from './horizontalRule'
import { Link } from './link'
import { TableCell } from './table/cell'
import { TableRow } from './table/row'
import Table from './table'
import { History } from './history'
import suggestion from './commands/suggestion'
import { createImageExtension } from './images/node'
import Commands from './commands'
import { InfoCallout } from './callouts/info'
import { WarningCallout } from './callouts/warning'
import { TipCallout } from './callouts/tip'
import { DraggableBlock } from './draggableBlock'
import { Document } from './document'
import { ExternalContent } from './external-content'
import { Heading } from './heading'
import { TrailingNode } from './trailingNode'
import { Placeholder } from './placeholder'
import { Collapsable } from './collapsable'
import { CollapsableHeader } from './collapsable/collapsableHeader'
import { CollapsableContent } from './collapsable/collapsableContent'

const tiptapExtensions = (isPublic: boolean): Extensions => {
  const { uploadFile } = useDocStore()

  return [
    Document,
    DraggableBlock,
    Paragraph,
    Text,
    Strike,
    Heading,
    Bold,
    Italic,
    HardBreak,
    DropCursor.configure({
      width: 2,
      class: 'titap-dropcursor',
      color: '#e6e6ff',
    }),
    Commands.configure({
      suggestion,
    }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') {
          return `Heading ${node.attrs.level}`
        }
        return 'Press / to open the command menu or start writing'
      },
    }),
    Task,
    Ordered,
    Bullet,
    HorizontalRule.extend({
      addKeyboardShortcuts() {
        return {
          'Ctrl-Space': () => {
            const from = this.editor.state.selection.from
            return this.editor
              .chain()
              .setHorizontalRule()
              .setTextSelection(from + 3)
              .run()
          },
        }
      },
    }),
    Code,
    CodeBlock,
    createImageExtension(async (image: any) => {
      return uploadFile(image)
    }),
    Underline,
    History,
    Blockquote.extend({
      addKeyboardShortcuts() {
        return {
          'Mod-]': () => this.editor.commands.toggleBlockquote(),
        }
      },
    }),
    InfoCallout,
    WarningCallout,
    TipCallout,
    Table.configure({
      resizable: !isPublic,
    }),
    TableRow,
    TableCell.configure({
      HTMLAttributes: {
        class: 'nc-docs-tiptap-table-cell relative',
      },
    }),
    ExternalContent,
    TrailingNode,
    Link({ isPublic }),
    CollapsableContent,
    CollapsableHeader,
    Collapsable,
  ]
}

export default tiptapExtensions
