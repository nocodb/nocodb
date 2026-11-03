// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'
import { Image } from './image'

vi.mock('../../../tiptap/functionality', () => ({ mdImageAsText: () => {} }))

const serialize = (content: Record<string, any>) => {
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, Image],
    content,
  })

  const nodeSerializers = {
    ...defaultMarkdownSerializer.nodes,
    image: Image.config.addStorage!.call({ editor } as any).markdown.serialize,
  }
  const serializer = new (defaultMarkdownSerializer.constructor as any)(nodeSerializers, defaultMarkdownSerializer.marks)

  return serializer.serialize(editor.state.doc)
}

describe('Image markdown serializer', () => {
  it('keeps text after an image on its own paragraph', () => {
    const markdown = serialize({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'before' }] },
        { type: 'image', attrs: { src: 'https://example.com/a.png', alt: 'a' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'after' }] },
      ],
    })

    expect(markdown).toBe('before\n\n![a](https://example.com/a.png)\n\nafter')
  })

  it('does not add trailing blank lines when the image is the last node', () => {
    const markdown = serialize({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'https://example.com/a.png', alt: 'a' } }],
    })

    expect(markdown).toBe('![a](https://example.com/a.png)')
  })
})
