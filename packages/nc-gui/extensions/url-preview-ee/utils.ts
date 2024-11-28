const urlMatchers: [string, (u: string) => string | null][] = []

const YOUTUBE_RE = /^https?:\/\/(www\.|)youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(.*)?$/
const YOUTUBE_SHORTEN_RE = /^https?:\/\/(www\.|)youtu\.be\/([a-zA-Z0-9_-]{11})(.*)?$/
const matchYoutube = (url: string) => {
  try {
    const match = url.match(YOUTUBE_RE) || url.match(YOUTUBE_SHORTEN_RE)
    if (!match) {
      return null
    }
    return `https://www.youtube.com/embed/${match[2]}`
  } catch {
    return null
  }
}
urlMatchers.push(['Youtube', matchYoutube])

const YOUTUBE_SHORTS_RE = /^https?:\/\/(www\.|)youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/
const matchYoutubeShorts = (url: string) => {
  try {
    const match = url.match(YOUTUBE_SHORTS_RE)
    if (!match) {
      return null
    }
    return `https://www.youtube.com/embed/${match[2]}`
  } catch {
    return null
  }
}
urlMatchers.push(['Youtube Shorts', matchYoutubeShorts])

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
    embedUrl += `?${urlObj.searchParams.toString()}`

    return embedUrl
  } catch {
    return null
  }
}
urlMatchers.push(['Google', matchGoogle])

const DRIVE_RE = /^https?:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)(?:\/.*)?(?:\?.*)?$/

const matchDrive = (url: string) => {
  try {
    const match = url.match(DRIVE_RE)
    if (!match) {
      return null
    }
    return `https://drive.google.com/embeddedfolderview?id=${match[1]}`
  } catch {
    return null
  }
}
urlMatchers.push(['Drive', matchDrive])

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
  } catch {
    return null
  }
}
urlMatchers.push(['Figma', matchFigma])

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
  } catch {
    return null
  }
}
urlMatchers.push(['Vimeo', matchVimeo])

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
  } catch {
    return null
  }
}
urlMatchers.push(['Loom', matchLoom])

const SPOTIFY_RE = /^https?:\/\/open\.spotify\.com\/(track|album|artist|playlist)\/([a-zA-Z0-9]+)(?:\?.*)?$/
const matchSpotify = (url: string) => {
  try {
    const match = url.match(SPOTIFY_RE)
    if (!match) {
      return null
    }
    // Simply insert /embed after domain
    return url.replace('open.spotify.com/', 'open.spotify.com/embed/')
  } catch {
    return null
  }
}
urlMatchers.push(['Spotify', matchSpotify])

const SOUNDCLOUD_RE = /^https?:\/\/(www\.|)soundcloud\.com\/([a-zA-Z0-9-_]+)(\/[a-zA-Z0-9-_]+)?(?:\?.*)?$/
const matchSoundCloud = (url: string) => {
  try {
    const match = url.match(SOUNDCLOUD_RE)
    if (!match) {
      return null
    }
    return `https://w.soundcloud.com/player/?url=${url}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`
  } catch {
    return null
  }
}
urlMatchers.push(['SoundCloud', matchSoundCloud])

// Twitter/X Posts
const TWITTER_RE = /^https?:\/\/(www\.|)(?:twitter|x)\.com\/\w+\/status\/(\d+)(?:\?.*)?$/
const matchTwitter = (url: string) => {
  try {
    const match = url.match(TWITTER_RE)
    if (!match) return null
    return `https://platform.twitter.com/embed/Tweet.html?id=${match[2]}`
  } catch {
    return null
  }
}
urlMatchers.push(['Twitter', matchTwitter])

// CodePen
const CODEPEN_RE = /^https?:\/\/codepen\.io\/([^\/]+)\/pen\/([^\/]+)(?:\?.*)?$/
const matchCodePen = (url: string) => {
  try {
    const match = url.match(CODEPEN_RE)
    if (!match) return null
    return `https://codepen.io/${match[1]}/embed/${match[2]}`
  } catch {
    return null
  }
}
urlMatchers.push(['CodePen', matchCodePen])

// GitHub Gists
const GIST_RE = /^https?:\/\/gist\.github\.com\/([^\/]+)\/([a-zA-Z0-9]+)(?:\?.*)?$/
const matchGist = (url: string) => {
  try {
    const match = url.match(GIST_RE)
    if (!match) return null
    return `https://gist.github.com/${match[1]}/${match[2]}.pibb`
  } catch {
    return null
  }
}
urlMatchers.push(['Gist', matchGist])

// Behance Projects
const BEHANCE_RE = /^https?:\/\/(www\.|)behance\.net\/gallery\/(\d+)\/([^\/\?]+)(?:\?.*)?$/
const matchBehance = (url: string) => {
  try {
    const match = url.match(BEHANCE_RE)
    if (!match) return null
    return `https://www.behance.net/embed/project/${match[2]}?ilo0=1`
  } catch {
    return null
  }
}
urlMatchers.push(['Behance', matchBehance])

// Dailymotion
const DAILYMOTION_RE = /^https?:\/\/(www\.|)dailymotion\.com\/video\/([a-zA-Z0-9]+)(?:\?.*)?$/
const matchDailymotion = (url: string) => {
  try {
    const match = url.match(DAILYMOTION_RE)
    if (!match) return null
    return `https://www.dailymotion.com/embed/video/${match[2]}`
  } catch {
    return null
  }
}
urlMatchers.push(['Dailymotion', matchDailymotion])

export const getEmbedURL = (url: string): [string, string] => {
  for (const matcher of urlMatchers) {
    const embedURL = matcher[1](url)
    if (embedURL) {
      return [matcher[0], embedURL]
    }
  }
  return ['unsupported', 'unsupported']
}
