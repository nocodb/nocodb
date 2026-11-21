import { decode as decodeHtmlEntities } from 'html-entities'
import { rewriteOutsideCode } from './outsideCode'

// Stops at the next '<' so an unclosed tag can't make the scan quadratic; stored attributes escape '<'
const IMG_TAG_REGEX = /<img\b[^<>]*>/gi

const URL_UNSAFE: Record<string, string> = { ' ': '%20', '(': '%28', ')': '%29' }

function imgTagAttr(tag: string, name: string) {
  return decodeHtmlEntities(tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1] ?? '')
}

/**
 * A resized image is stored as an <img> tag. Views that don't render images (read views, the grid)
 * show it as the markdown image it stands for, so it gets the same treatment as every other image.
 */
export function imgTagsToMarkdown(text: string) {
  return rewriteOutsideCode(text, (line) =>
    line.replace(IMG_TAG_REGEX, (tag) => {
      const alt = imgTagAttr(tag, 'alt').replace(/[[\]\\]/g, '\\$&')
      const src = imgTagAttr(tag, 'src').replace(/[ ()]/g, (char) => URL_UNSAFE[char]!)
      return `![${alt}](${src})`
    }),
  )
}
