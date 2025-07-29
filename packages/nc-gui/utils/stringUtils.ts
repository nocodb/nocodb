export function getHTMLEncodedText(htmlString: string) {
  const div = document.createElement('div')
  div.textContent = htmlString || ''
  return div.innerHTML
}

export const truncateText = (text: string, maxLength: number = 50) => {
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength - 3)}...`
}
