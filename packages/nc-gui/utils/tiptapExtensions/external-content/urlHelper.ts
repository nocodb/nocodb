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
  console.log(type)
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

export const airtableUrlToEmbedUrl = (url: string) => {
  const id = url.split('.com/')[1]
  return `https://airtable.com/embed/${id}?backgroundColor=blue`
}

export const codepenUrlToEmbedUrl = (url: string) => {
  const userId = url.split('.io/')[1].split('/')[0]
  const id = url.split('/pen/')[1]
  return `https://codepen.io/${userId}/embed/${id}?default-tab=html%2Cresult`
}

export const trelloUrlToEmbedUrl = (url: string) => {
  const id = url.split('.com/b/')[1].split('/')[0]
  return `https://trello.com/embed/board?id=${id}`
}

export const miroUrlToEmbedUrl = (url: string) => {
  return url.replace('miro.com/app/board', 'miro.com/app/embed')
}

export function getExternalContentType(url: any) {
  if (!url) return
  // google docs
  if (url.match(/docs.google.com\/document/g)) {
    return 'googleDoc'
  }
  // google sheets
  if (url.match(/docs.google.com\/spreadsheets/g)) {
    return 'googleSheet'
  }
  // google slides
  if (url.match(/docs.google.com\/presentation/g)) {
    return 'googleSlide'
  }
  // youtube
  if (url.match(/youtube.com/g) || url.match(/youtu.be/g)) {
    return 'youtube'
  }
  // github gist
  if (url.match(/gist.github.com/g)) {
    return 'githubGist'
  }
  // figma
  if (url.match(/figma.com/g)) {
    return 'figma'
  }
  // airtable
  if (url.match(/airtable.com/g)) {
    return 'airtable'
  }
  // clickup
  if (url.match(/clickup.com/g)) {
    return 'clickup'
  }
  // codepen
  if (url.match(/codepen.io/g)) {
    return 'codepen'
  }
  // trello
  if (url.match(/trello.com/g)) {
    return 'trello'
  }
  // miro
  if (url.match(/miro.com/g)) {
    return 'miro'
  }
  // typeform
  if (url.match(/typeform.com/g)) {
    return 'typeform'
  }
}

export const urlToEmbedUrl = (url: string, type?: string) => {
  console.log('type', type)
  if (!type) {
    type = getExternalContentType(url)
  }
  if (!type) throw new Error('No type provided')

  if (type === 'youtube') {
    url = youtubeUrlToEmbedUrl(url)
  }

  if (type.startsWith('google')) {
    url = gSuiteUrlToEmbedUrl(url, type)!
  }

  if (type === 'githubGist') {
    url = githubGistUrlToEmbedUrl(url)
  }

  if (type === 'figma') {
    url = figmaUrlToEmbedUrl(url)
  }

  if (type === 'airtable') {
    url = airtableUrlToEmbedUrl(url)
  }

  if (type === 'codepen') {
    url = codepenUrlToEmbedUrl(url)
  }

  if (type === 'trello') {
    url = trelloUrlToEmbedUrl(url)
  }

  if (type === 'miroUrlToEmbedUrl') {
    url = miroUrlToEmbedUrl(url)
  }

  return url
}
