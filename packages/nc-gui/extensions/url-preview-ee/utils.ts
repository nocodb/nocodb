const YOUTUBE_RE = /^https?:\/\/(www\.|)youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:\?.*)?$/
const matchYoutube = (url: string) => {
  try {
    const match = url.match(YOUTUBE_RE)
    if (!match) {
      return null
    }
    return `https://www.youtube.com/embed/${match[2]}`
  } catch (error) {
    return null
  }
}

const GOOGLE_RE =
  /^https?:\/\/(docs|drive)\.google\.com\/(document|spreadsheets|presentation|file)\/d\/([a-zA-Z0-9_-]+)(?:\/.*)?(?:\?.*)?$/

const matchGoogle = (url: string) => {
  try {
    const match = url.match(GOOGLE_RE)
    if (!match) {
      return null
    }
    const [, domain, type, docId] = match

    const urlObj = new URL(url)
    let embedUrl = `https://${domain}.google.com/${type}/d/${docId}/preview`
    urlObj.searchParams.set('embed', 'true')
    embedUrl += '?' + urlObj.searchParams.toString()

    return embedUrl
  } catch {
    return null
  }
}

const FIGMA_RE =
  /^https?:\/\/(www\.|)figma\.com\/(file|proto|design)\/([0-9a-zA-Z]{22,})(?:\/.*)?(?:\?node-id=([0-9%:A-Za-z-]+))?/

const matchFigma = (url: string) => {
  try {
    const match = url.match(FIGMA_RE)
    if (!match) {
      return null
    }

    const [, , type, fileId, nodeId] = match
    let embedUrl = null
    switch (type) {
      case 'file':
        embedUrl = `https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/file/${fileId}`
        if (nodeId) {
          embedUrl += `/?node-id=${nodeId}`
        }
        break
      case 'proto':
        embedUrl = `https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/proto/${fileId}`
        break
      case 'design':
        embedUrl = `https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/design/${fileId}`
        if (nodeId) {
          embedUrl += `/?node-id=${nodeId}`
        }
        break
    }
    return embedUrl
  } catch (error) {
    return null
  }
}

const VIMEO_RE = /^https?:\/\/(www\.|)vimeo\.com\/(\d+)(?:\?.*)?$/
const matchVimeo = (url: string) => {
  try {
    const match = url.match(VIMEO_RE)
    if (!match) {
      return null
    }
    const videoId = match[2]
    // Build embed URL with parameters
    return `https://player.vimeo.com/video/${videoId}`
  } catch (error) {
    return null
  }
}

const LOOM_RE = /^https?:\/\/(www\.|share\.|)loom\.com\/(share|embed)\/([a-zA-Z0-9]+)(?:\?.*)?$/
const matchLoom = (url: string) => {
  try {
    const match = url.match(LOOM_RE)

    if (!match) {
      return null
    }
    const videoId = match[3]

    // Build embed URL
    return `https://www.loom.com/embed/${videoId}`
  } catch (error) {
    return null
  }
}

const SPOTIFY_RE = /^https?:\/\/open\.spotify\.com\/(track|album|artist|playlist)\/([a-zA-Z0-9]+)(?:\?.*)?$/
const matchSpotify = (url: string) => {
  try {
    const match = url.match(SPOTIFY_RE)
    if (!match) {
      return null
    }
    // Simply insert /embed after domain
    return url.replace('open.spotify.com/', 'open.spotify.com/embed/')
  } catch (error) {
    return null
  }
}

const SOUNDCLOUD_RE = /^https?:\/\/(www\.|)soundcloud\.com\/([a-zA-Z0-9-_]+)(\/[a-zA-Z0-9-_]+)?(?:\?.*)?$/
const matchSoundCloud = (url: string) => {
  try {
    const match = url.match(SOUNDCLOUD_RE)
    if (!match) {
      return null
    }
    return `https://w.soundcloud.com/player/?url=${url}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`
  } catch (error) {
    return null
  }
}

export const getEmbedURL = (url: string) => {
  if (matchYoutube(url)) {
    return matchYoutube(url)
  } else if (matchFigma(url)) {
    return matchFigma(url)
  } else if (matchGoogle(url)) {
    return matchGoogle(url)
  } else if (matchVimeo(url)) {
    return matchVimeo(url)
  } else if (matchLoom(url)) {
    return matchLoom(url)
  } else if (matchSpotify(url)) {
    return matchSpotify(url)
  } else if (matchSoundCloud(url)) {
    return matchSoundCloud(url)
  } else {
    return "unsupported"
  }
}
