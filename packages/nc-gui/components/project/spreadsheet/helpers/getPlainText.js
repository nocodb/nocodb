export default function getPlainText(htmlString) {
  const div = document.createElement('div')
  div.textContent = htmlString || ''
  return div.innerHTML
}
