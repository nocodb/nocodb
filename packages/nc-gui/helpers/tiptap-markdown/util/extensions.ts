import type { AnyExtension } from '@tiptap/core'
import { Bold, Code, HTMLMark, Italic, Link, Strike, Underline } from '../extensions/marks'
import {
  Blockquote,
  BulletList,
  CodeBlock,
  HTMLNode,
  HardBreak,
  Heading,
  HorizontalRule,
  Image,
  ListItem,
  OrderedList,
  Paragraph,
  Table,
  TaskItem,
  TaskList,
} from '../extensions/nodes'

const getDefaultMarkdownSpec = (extension: AnyExtension) => {
  return [
    // Nodes
    Blockquote,
    BulletList,
    CodeBlock,
    HardBreak,
    Heading,
    HorizontalRule,
    HTMLNode,
    Image,
    ListItem,
    OrderedList,
    Paragraph,
    Table,
    TaskItem,
    TaskList,

    // Marks
    Bold,
    Code,
    HTMLMark,
    Italic,
    Link,
    Strike,
    Underline,
  ].find((e: AnyExtension) => e.name === extension.name)?.storage?.markdown
}

export function getMarkdownSpec(extension: AnyExtension) {
  const markdownSpec = extension.storage?.markdown
  const defaultMarkdownSpec = getDefaultMarkdownSpec(extension)

  if (markdownSpec || defaultMarkdownSpec) {
    return {
      ...(defaultMarkdownSpec ?? {}),
      ...(markdownSpec ?? {}),
    }
  }

  return null
}
