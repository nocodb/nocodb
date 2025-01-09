export function elementFromString(value) {
  // add a wrapper to preserve leading and trailing whitespace
  const wrappedValue = `<body>${value}</body>`

  return new window.DOMParser().parseFromString(wrappedValue, 'text/html').body
}

export function escapeHTML(value) {
  return value?.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function extractElement(node) {
  const parent = node.parentElement
  const prepend = parent.cloneNode()

  while (parent.firstChild && parent.firstChild !== node) {
    prepend.appendChild(parent.firstChild)
  }

  if (prepend.childNodes.length > 0) {
    parent.parentElement.insertBefore(prepend, parent)
  }
  parent.parentElement.insertBefore(node, parent)
  if (parent.childNodes.length === 0) {
    parent.remove()
  }
}

export function unwrapElement(node) {
  const parent = node.parentNode

  while (node.firstChild) parent.insertBefore(node.firstChild, node)

  parent.removeChild(node)
}
