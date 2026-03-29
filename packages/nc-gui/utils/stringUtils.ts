export function getHTMLEncodedText(htmlString: string) {
  const div = document.createElement('div')
  div.textContent = htmlString || ''
  return div.innerHTML
}

export function truncateText(text: string, maxLength = 50) {
  if (ncIsNullOrUndefined(text)) {
    return ''
  }
  text = `${text}`
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength - 3)}...`
}

export function capitalize(str?: string | null): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}
