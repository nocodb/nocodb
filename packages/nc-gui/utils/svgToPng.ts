function copyStylesInline(destinationNode: any, sourceNode: any) {
  const containerElements = ['svg', 'g']
  for (let cd = 0; cd < destinationNode.childNodes.length; cd++) {
    const child = destinationNode.childNodes[cd]
    if (containerElements.includes(child.tagName)) {
      copyStylesInline(child, sourceNode.childNodes[cd])
      continue
    }

    const style = sourceNode.childNodes[cd].currentStyle || window.getComputedStyle(sourceNode.childNodes[cd])
    if (style === 'undefined' || style == null) continue
    for (let st = 0; st < style.length; st++) {
      child.style.setProperty(style[st], style.getPropertyValue(style[st]))
    }
  }
}

function triggerDownload(imgURI: string, fileName: string) {
  const evt = new MouseEvent('click', {
    view: window,
    bubbles: false,
    cancelable: true,
  })
  const a = document.createElement('a')
  a.setAttribute('download', fileName)
  a.setAttribute('href', imgURI)
  a.setAttribute('target', '_blank')
  a.setAttribute('rel', 'noopener,noreferrer')
  a.dispatchEvent(evt)
}

function downloadSvg(svg: SVGGraphicsElement, fileName: string) {
  const copy = svg.cloneNode(true)

  copyStylesInline(copy, svg)

  const canvas = document.createElement('canvas')
  const bbox = svg.getBBox()
  canvas.width = bbox.width
  canvas.height = bbox.height

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, bbox.width, bbox.height)

  const data = new XMLSerializer().serializeToString(copy)
  const DOMURL = window.URL || window.webkitURL || window
  const img = new Image()
  const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
  const url = DOMURL.createObjectURL(svgBlob)

  img.onload = function () {
    ctx.drawImage(img, 0, 0)
    DOMURL.revokeObjectURL(url)
    if (typeof navigator !== 'undefined' && navigator.msSaveOrOpenBlob) {
      const blob = canvas.msToBlob()
      navigator.msSaveOrOpenBlob(blob, fileName)
    } else {
      const imgURI = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream')
      triggerDownload(imgURI, fileName)
    }
    console.log(canvas)

    // TODO: Somehow canvas dom element is getting deleted
    // document.removeChild(canvas)
  }
  img.src = url
}

export { downloadSvg }
