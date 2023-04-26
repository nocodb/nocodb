import Underline from '@tiptap/extension-underline'
import Text from '@tiptap/extension-text'
import DropCursor from '@tiptap/extension-dropcursor'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Code from '@tiptap/extension-code'
import HardBreak from '@tiptap/extension-hard-break'
import type { Extensions } from '@tiptap/core'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { Quote } from './quote'
import { createAttachmentExtension } from './attachment/node'
import { Bullet } from './listItem/bullet'
import { Ordered } from './listItem/ordered'
import { Task } from './listItem/task'
import { Divider } from './divider'
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
import { SectionBlock } from './section'
import { Document } from './document'
import { Embed } from './embed'
import { Heading } from './heading'
import { TrailingNode } from './trailingNode'
import { Placeholder } from './placeholder'
import { CollapsableNode } from './collapsable'
import { CollapsableHeaderNode } from './collapsable/collapsableHeader'
import { CollapsableContentNode } from './collapsable/collapsableContent'
import { Strike } from './strike'
import { Paragraph } from './paragraph'
import { CodeBlock } from './codeBlock'
import { ColumnContentNode } from './columns/columnContent'
import { ColumnNode } from './columns'

const tiptapExtensions = (isPublic: boolean): Extensions => {
  const { uploadFile } = useDocStore()

  return [
    Document,
    SectionBlock,
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
        if (node.type.name === TiptapNodesTypes.heading) {
          return `Heading ${node.attrs.level}`
        }
        return 'Press / to open the command menu or start writing'
      },
    }),
    Task,
    Ordered,
    Bullet,
    Divider,
    Code,
    CodeBlock,
    createImageExtension(async (image: any) => {
      return uploadFile(image)
    }),
    Underline,
    History,
    Quote,
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
    Embed,
    TrailingNode,
    Link({ isPublic }),
    CollapsableContentNode,
    CollapsableHeaderNode,
    CollapsableNode,
    createAttachmentExtension(async (image: any) => {
      return uploadFile(image)
    }),
    ColumnContentNode,
    ColumnNode,
  ]
}

export default tiptapExtensions
