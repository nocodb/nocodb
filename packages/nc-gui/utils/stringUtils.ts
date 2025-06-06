export function getHTMLEncodedText(htmlString: string) {
  const div = document.createElement('div')
  div.textContent = htmlString || ''
  return div.innerHTML
}

export function capitalizeFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.substring(1)
}
