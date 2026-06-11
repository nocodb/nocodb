import type { AnyExtension } from '@tiptap/core'
import markdownExtensions from '../extensions/defaultMarkdownExtensions'

const getDefaultMarkdownSpec = (extension: AnyExtension) => {
  return markdownExtensions.find((e: AnyExtension) => e.name === extension.name)?.storage?.markdown
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
