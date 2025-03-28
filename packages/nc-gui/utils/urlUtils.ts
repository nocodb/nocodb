import isURL from 'validator/lib/isURL'
import { decode } from 'html-entities'
import { isValidURL } from 'nocodb-sdk'
import { formulaTextSegmentsCache, replaceUrlsWithLinkCache } from '../components/smartsheet/grid/canvas/utils/canvas'
import { getI18n } from '../plugins/a.i18n'
export { isValidURL }

const _replaceUrlsWithLink = (text: string): boolean | string => {
  if (!text) {
    return false
  }
  const rawText = text.toString()

  const protocolRegex = /^(https?|ftp|mailto|file):\/\//
  let isUrlPatternFound = false
  const out = rawText.replace(
    /**
     * Matches patterns of the form:
     * URI::(url_content)[optional space]LABEL::(label_content)
     *
     * - `URI::(...)` - Extracts the URL content between parentheses.
     * - `LABEL::(...)` - (Optional) Extracts the label content between parentheses.
     * - `(?:...)` - Non-capturing groups used for optional and grouped patterns.
     * - `[^()]|\\\)|\\\(` - Matches any character except parentheses or escaped parentheses.
     * - `\s*` - Matches any optional spaces between the URI and LABEL parts.
     *
     * Important Notes:
     * - Whitespace around the content is now optional and is
     *   trimmed later during processing.
     * - This prevents trailing backslashes (`\`) from being treated
     *   as escape sequences when followed by a closing parenthesis.
     *
     * Example Matches:
     * - URI::(https://example.com)
     * - URI::(https://example.com) LABEL::(My Label)
     * - URI::(https://example.com\)with\)escapes) LABEL::(Label\))
     */
    /URI::\(((?:[^()]|\\\)|\\\()*[^\\]|)\)(?:\s*LABEL::\(((?:[^()]|\\\)|\\\()*[^\\]|)\))?/g,
    (_, _url, _label) => {
      isUrlPatternFound = true
      let isUrl = false
      // replace whitespace at beginning and end of URL and label if found
      // Unescape escaped parentheses (`(` and `)`) in the URL and label content
      const url = _url.replace(/^ | $/g, '').replace(/\\([()])/g, '$1')
      const label = _label?.replace(/^ | $/g, '').replace(/\\([()])/g, '$1')

      if (!url.trim()) {
        return label || ' '
      }

      const fullUrl = protocolRegex.test(url) ? url : url.trim() ? `https://${url}` : ''

      isUrl = isURL(fullUrl)

      const anchorLabel = label || url || ''

      if (!isUrl) return anchorLabel

      const a = document.createElement('a')
      a.textContent = anchorLabel
      a.setAttribute('href', decode(fullUrl))
      a.setAttribute('class', 'nc-cell-field-link')
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
      a.setAttribute('onClick', 'window.tiptapLinkHandler(event)')
      return a.outerHTML
    },
  )

  return isUrlPatternFound ? out : false // Return false if no URL found
}

export const replaceUrlsWithLink = (text: string) => {
  if (replaceUrlsWithLinkCache.has(text)) {
    return replaceUrlsWithLinkCache.get(text)!
  }
  const result = _replaceUrlsWithLink(text)
  replaceUrlsWithLinkCache.set(text, result)
  return result
}

export function getFormulaTextSegments(anchorLinkHTML: string) {
  if (formulaTextSegmentsCache.has(anchorLinkHTML)) {
    return formulaTextSegmentsCache.get(anchorLinkHTML)!
  }
  const container = document.createElement('div')
  container.innerHTML = anchorLinkHTML

  const result: Array<{ text: string; url?: string }> = []

  function traverseNodes(node: ChildNode) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent
      if (text) {
        result.push({ text })
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as Element).tagName === 'A') {
        const anchor = node as HTMLAnchorElement
        result.push({ text: node.textContent ?? '', url: anchor.href })
      } else {
        node.childNodes.forEach(traverseNodes)
      }
    }
  }

  container.childNodes.forEach(traverseNodes)
  formulaTextSegmentsCache.set(anchorLinkHTML, result)
  return result
}

export const openLink = (path: string, baseURL?: string, target = '_blank') => {
  const url = new URL(path, baseURL)
  window.open(url.href, target, 'noopener,noreferrer')
}

export const navigateToBlankTargetOpenOption = {
  target: '_blank',
  windowFeatures: {
    noopener: true,
    noreferrer: true,
  },
}

export const addMissingUrlSchma = (url?: string) => {
  url = url?.trim?.() ?? ''

  if (!url) return ''

  if (/^(https?|ftp|file):\/\/|^(mailto|tel):/i.test(url)) return url

  return `https://${url}`
}

export const isSameOriginUrl = (url: string, addMissingUrlSchema = false) => {
  if (addMissingUrlSchema) {
    url = addMissingUrlSchma(url)
  }

  try {
    return new URL(url, window.location.origin).origin === window.location.origin
  } catch {
    return false // Invalid URL
  }
}

const handleCopyToClipboard = async (text: string) => {
  const { copy } = useCopy()

  try {
    await copy(text)
    // Copied to clipboard
    message.info(getI18n().global.t('msg.info.copyToClipboardLocalFileUrl'))
  } catch (e: any) {
    message.error(e.message)
  }
}

export const confirmPageLeavingRedirect = (url: string, target?: '_blank') => {
  url = addMissingUrlSchma(url)

  if (!url) return

  if (!url.startsWith('http')) {
    /**
     * Issue: Not allowed to load local resource
     * To workaround this we can copy url to clipboard and user can manually paste it
     */
    if (url.startsWith('file')) {
      return handleCopyToClipboard(url)
    }

    const link = document.createElement('a')
    link.href = url
    if (target) {
      link.target = target
      link.rel = 'noopener noreferrer nofollow' // Prevents opener access & prefetching
    }
    link.style.display = 'none' // Hide the link
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    return
  }

  // Don't do anything if url is not valid, just warn in console for debugging purpose
  if (!isValidURL(url)) {
    console.warn('Invalid URL:', url)
    return
  }

  // No need to navigate to leaving page if it is same origin url
  if (isSameOriginUrl(url) || !ncIsSharedViewOrBase()) {
    window.open(url, target, target === '_blank' ? 'noopener,noreferrer' : undefined)
  } else {
    const leavingUrl = new URL(`${window.location.origin}/#/leaving`)
    leavingUrl.hash = `#/leaving?ncRedirectUrl=${encodeURIComponent(url)}&ncBackUrl=${encodeURIComponent(window.location.href)}`

    navigateTo(leavingUrl.toString(), {
      open: {
        target: '_blank',
        windowFeatures: {
          noopener: true,
          noreferrer: true,
        },
      },
    })
  }
}

export const addConfirmPageLeavingRedirectToWindow = (remove = false) => {
  if (typeof window === 'undefined') return

  if (remove) {
    localStorage.removeItem('ncIsSharedViewOrBase')
    return
  }

  localStorage.setItem('ncIsSharedViewOrBase', 'true')

  window.tiptapLinkHandler = (event) => {
    event.preventDefault()

    if (event?.target?.href) {
      confirmPageLeavingRedirect(event?.target?.href, '_blank')
    }
  }
}

export const isLinkExpired = async (url: string) => {
  try {
    // test if the url is accessible or not
    const res = await fetch(url, { method: 'HEAD' })
    if (res.ok) {
      return false
    }
  } catch {
    return true
  }

  return true
}

export const extractYoutubeVideoId = (url: string) => {
  if (typeof url !== 'string') {
    return ''
  }

  // Regular expressions to match different YouTube URL formats
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,
    /(?:https?:\/\/)?youtu\.be\/([^?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^?]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return ''
}
