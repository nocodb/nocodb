import BulletList from '@tiptap/extension-bullet-list'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Underline from '@tiptap/extension-underline'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import DropCursor from '@tiptap/extension-dropcursor'
import ListItem from '@tiptap/extension-list-item'
import Bold from '@tiptap/extension-bold'
import Strike from '@tiptap/extension-strike'
import CodeBlock from '@tiptap/extension-code-block'
import Blockquote from '@tiptap/extension-blockquote'
import type { Extensions } from '@tiptap/core'
import { TableCell } from './table/TableCell'
import { TableHeader } from './table/header'
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

const tiptapExtensions = (): Extensions => {
  const { uploadFile } = useDocs()

  return [
    Document,
    DraggableBlock,
    Paragraph,
    Text,
    Strike,
    Heading,
    ListItem,
    Bold,
    DropCursor.configure({
      width: 2,
      class: 'titap-dropcursor',
      color: '#e6e6ff',
    }),
    Commands.configure({
      suggestion,
    }),
    Placeholder.configure({
      placeholder: 'Press / to open the command menu or start writing',
    }),
    BulletList,
    TaskList.configure({
      HTMLAttributes: {
        class: 'nc-docs-task-list',
      },
    }),
    TaskItem.configure({
      nested: true,
    }),
    HorizontalRule.configure({
      HTMLAttributes: {
        class: 'nc-docs-horizontal-rule',
      },
    }),
    CodeBlock,
    createImageExtension(async (image: any) => {
      return uploadFile(image)
    }),
    Underline,
    History,
    Blockquote,
    InfoCallout,
    WarningCallout,
    TipCallout,
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell.configure({
      HTMLAttributes: {
        class: 'nc-docs-tiptap-table-cell relative',
      },
    }),
    ExternalContent,
    TrailingNode,
  ]
}

export default tiptapExtensions
