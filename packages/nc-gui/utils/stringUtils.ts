export function getHTMLEncodedText(htmlString: string) {
  const div = document.createElement('div')
  div.textContent = htmlString || ''
  return div.innerHTML
}

export const truncateText = (text: string, maxLength = 50) => {
  if (ncIsNullOrUndefined(text)) {
    return ''
  }
  text = `${text}`
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength - 3)}...`
}

export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
