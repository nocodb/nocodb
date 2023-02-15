const youtubeUrlToId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

export const youtubeUrlToEmbedUrl = (url: string) => {
  const youtubeId = youtubeUrlToId(url)
  return `https://www.youtube.com/embed/${youtubeId}`
}

export const gSuiteUrlToEmbedUrl = (url: string, type: string) => {
  const id = url.split('d/')[1].split('/')[0]
  let iframeLinkType
  switch (type) {
    case 'googleDoc':
      iframeLinkType = 'document'
      break
    case 'googleSheet':
      iframeLinkType = 'spreadsheets'
      break
    case 'googleSlide':
      iframeLinkType = 'presentation'
  }

  return `https://docs.google.com/${iframeLinkType}/d/${id}/preview`
}

export const githubGistUrlToEmbedUrl = (url: string) => {
  return `data:text/html;charset=utf-8,
  <head><base target='_blank' /></head>
  <body><script src='${url}.js'></script>
  </body>`
}

export const figmaUrlToEmbedUrl = (url: string) => {
  return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`
}
