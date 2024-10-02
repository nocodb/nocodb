import isURL, { type IsURLOptions } from 'validator/lib/isURL'
import { decode } from 'html-entities'

export const replaceUrlsWithLink = (text: string): boolean | string => {
  if (!text) {
    return false
  }
  const rawText = text.toString()

  const protocolRegex = /^(https?|ftp|mailto|file):\/\//
  let isUrl

  const out = rawText.replace(/URI::\(([^)]*)\)(?: LABEL::\(([^)]*)\))?/g, (_, url, label) => {
    if (!url.trim() && !label) {
      return ' '
    }

    const fullUrl = protocolRegex.test(url) ? url : url.trim() ? `http://${url}` : ''

    isUrl = isURL(fullUrl)

    const anchorLabel = label || url || ''

    const a = document.createElement('a')
    a.textContent = anchorLabel
    a.setAttribute('href', decode(fullUrl))
    a.setAttribute('class', ' nc-cell-field-link')
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener,noreferrer')
    return a.outerHTML
  })

  return isUrl ? out : false
}

export const isValidURL = (str: string, extraProps?: IsURLOptions) => {
  return isURL(`${str}`, extraProps)
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
