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

// Google Maps — place, coordinates, search, and short links
const GOOGLE_MAPS_PLACE_COORDS_RE =
  /^https?:\/\/(www\.)?google\.[a-z.]+\/maps\/place\/[^\/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+)z/
const GOOGLE_MAPS_PLACE_RE = /^https?:\/\/(www\.)?google\.[a-z.]+\/maps\/place\/([^\/\?@]+)/
const GOOGLE_MAPS_AT_RE = /^https?:\/\/(www\.)?google\.[a-z.]+\/maps\/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+)z/
const GOOGLE_MAPS_SEARCH_PATH_RE = /^https?:\/\/(www\.)?google\.[a-z.]+\/maps\/search\/([^\/\?]+)/
const GOOGLE_MAPS_QUERY_RE = /^https?:\/\/(www\.)?google\.[a-z.]+\/maps.*[\?&]q=([^&]+)/
const GOOGLE_MAPS_SHORT_RE = /^https?:\/\/(goo\.gl\/maps\/|maps\.app\.goo\.gl\/)/

const matchGoogleMaps = (url: string) => {
  try {
    // Place URL with lat/lng/zoom
    const placeCoordsMatch = url.match(GOOGLE_MAPS_PLACE_COORDS_RE)
    if (placeCoordsMatch) {
      const [, , lat, lng, zoom] = placeCoordsMatch
      return `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`
    }

    // Place URL without coordinates — use the place name as query
    const placeMatch = url.match(GOOGLE_MAPS_PLACE_RE)
    if (placeMatch) {
      return `https://maps.google.com/maps?q=${placeMatch[2]}&output=embed`
    }

    // Coordinates-only URL
    const atMatch = url.match(GOOGLE_MAPS_AT_RE)
    if (atMatch) {
      const [, , lat, lng, zoom] = atMatch
      return `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`
    }

    // Query parameter (supports ?q= anywhere in the URL)
    const queryMatch = url.match(GOOGLE_MAPS_QUERY_RE)
    if (queryMatch) {
      return `https://maps.google.com/maps?q=${queryMatch[2]}&output=embed`
    }

    // Search path
    const searchMatch = url.match(GOOGLE_MAPS_SEARCH_PATH_RE)
    if (searchMatch) {
      return `https://maps.google.com/maps?q=${searchMatch[2]}&output=embed`
    }

    // Short links — pass through as-is (Google redirects work in iframes)
    if (GOOGLE_MAPS_SHORT_RE.test(url)) {
      return url
    }

    return null
  } catch {
    return null
  }
}
urlMatchers.push(['Google Maps', matchGoogleMaps])

const FIGMA_RE =
  /^https?:\/\/(www\.|)figma\.com\/(file|proto|design|board)\/([0-9a-zA-Z]{22,})(?:\/.*)?(?:\?node-id=([0-9%:A-Za-z-]+))?/

const FIGMA_COMMUNITY_RE = /^https?:\/\/(www\.|)figma\.com\/community\/file\/(\d+)(?:\/.*)?(?:\?.*)?$/

const matchFigma = (url: string) => {
  try {
    // Community files — use the Figma oEmbed-style embed
    const communityMatch = url.match(FIGMA_COMMUNITY_RE)
    if (communityMatch) {
      return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`
    }

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
      case 'board':
        embedUrl = `https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/board/${fileId}`
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

// CodePen — supports both user pens and team pens
// e.g. codepen.io/user/pen/hash or codepen.io/team/name/pen/hash
const CODEPEN_RE = /^https?:\/\/codepen\.io\/(.+?)\/pen\/([^\/\?]+)(?:\?.*)?$/
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
const DAILYMOTION_RE = /^https?:\/\/(?:www\.)?(?:dailymotion\.com\/video|dai\.ly)\/([a-zA-Z0-9]+)(?:\?.*)?$/

const matchDailymotion = (url: string) => {
  try {
    const match = url.match(DAILYMOTION_RE)
    if (!match) return null
    return `https://www.dailymotion.com/embed/video/${match[1]}`
  } catch {
    return null
  }
}
urlMatchers.push(['Dailymotion', matchDailymotion])

// Notion
const NOTION_RE = /^https?:\/\/([a-zA-Z0-9-]+)\.notion\.site\/(?:[a-zA-Z0-9-]+-)?([a-f0-9]{32})(?:\?.*)?$/
const matchNotion = (url: string) => {
  try {
    const match = url.match(NOTION_RE)
    if (!match) return null

    const siteSubdomain = match[1]
    const pageId = match[2]

    // Construct embed URL with /ebd/{pageId}
    return `https://${siteSubdomain}.notion.site/ebd/${pageId}`
  } catch {
    return null
  }
}

urlMatchers.push(['Notion', matchNotion])

const TED_RE = /^https?:\/\/(www\.)?ted\.com\/talks\/([^\/\?]+)(?:\?.*)?$/
const matchTed = (url: string) => {
  try {
    const match = url.match(TED_RE)
    if (!match) return null
    return `https://embed.ted.com/talks/${match[2]}`
  } catch {
    return null
  }
}
urlMatchers.push(['TED', matchTed])

const JSFIDDLE_RE = /^https?:\/\/jsfiddle\.net\/([a-zA-Z0-9]+)(?:\/(\d+))?\/?$/
const matchJSFiddle = (url: string) => {
  try {
    const match = url.match(JSFIDDLE_RE)
    if (!match) return null
    const user = match[1]
    const version = match[2] || '1' // default to version 1 if not present
    return `https://jsfiddle.net/${user}/${version}/embedded/`
  } catch {
    return null
  }
}
urlMatchers.push(['JSFiddle', matchJSFiddle])

const STACKBLITZ_RE = /^https?:\/\/stackblitz\.com\/edit\/([a-zA-Z0-9-_]+)(?:\?.*)?$/
const matchStackBlitz = (url: string) => {
  try {
    const match = url.match(STACKBLITZ_RE)
    if (!match) return null
    return `https://stackblitz.com/edit/${match[1]}?embed=1`
  } catch {
    return null
  }
}
urlMatchers.push(['StackBlitz', matchStackBlitz])

const CODESANDBOX_RE = /^https?:\/\/codesandbox\.io\/(?:s|embed)\/([a-zA-Z0-9-_]+)(?:\?.*)?$/
const matchCodeSandbox = (url: string) => {
  try {
    const match = url.match(CODESANDBOX_RE)
    if (!match) return null
    return `https://codesandbox.io/embed/${match[1]}?fontsize=14&hidenavigation=1&theme=dark`
  } catch {
    return null
  }
}
urlMatchers.push(['CodeSandbox', matchCodeSandbox])

// NocoDB shared views — already iframeable, pass the URL through as-is
// Supports both hash-based (/#/nc/view/...) and non-hash (/nc/view/...) URL formats
const NOCODB_SHARED_RE = /^https?:\/\/[^\/]+\/(?:#\/)?nc\/(view|form|gallery|kanban|map|calendar|dashboard)\/([a-zA-Z0-9_-]+)/
const matchNocoDB = (url: string) => {
  try {
    const match = url.match(NOCODB_SHARED_RE)
    if (!match) return null
    // Shared view URLs are directly embeddable
    return url
  } catch {
    return null
  }
}
urlMatchers.push(['NocoDB', matchNocoDB])

export const getEmbedURL = (url: string): [string, string] => {
  for (const matcher of urlMatchers) {
    const embedURL = matcher[1](url)
    if (embedURL) {
      return [matcher[0], embedURL]
    }
  }
  return ['unsupported', 'unsupported']
}
