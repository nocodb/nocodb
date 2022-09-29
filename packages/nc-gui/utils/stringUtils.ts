export function getHTMLEncodedText(htmlString: string) {
  const div = document.createElement('div')
  div.textContent = htmlString || ''
  return div.innerHTML
}
