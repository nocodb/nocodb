const allowedDomains = [
  'airtable.com',
  '*.airtable.com',
  'canva.com',
  '*.canva.com',
  'clickup.com',
  '*.clickup.com',
  'codepen.io',
  '*.codepen.io',
  'dbdiagram.io',
  '*.dbdiagram.io',
  'diagrams.net',
  '*.diagrams.net',
  'draw.io',
  '*.draw.io',
  'descript.com',
  '*.descript.com',
  'dropbox.com',
  '*.dropbox.com',
  'figma.com',
  '*.figma.com',
  'framer.com',
  '*.framer.com',
  '*.framer.website',
  'gist.github.com',
  'gitlab.com',
  '*.gitlab.com',
  'gliffy.com',
  '*.gliffy.com',
  'google.com',
  '*.google.com',
  'getgrist.com',
  '*.getgrist.com',
  'instagram.com',
  '*.instagram.com',
  'loom.com',
  '*.loom.com',
  'lucidchart.com',
  '*.lucidchart.com',
  'lucid.co',
  '*.lucid.co',
  'marvelapp.com',
  '*.marvelapp.com',
  'mindmeister.com',
  '*.mindmeister.com',
  'miro.com',
  '*.miro.com',
  'prezi.com',
  '*.prezi.com',
  'scribehow.com',
  '*.scribehow.com',
  'spotify.com',
  '*.spotify.com',
  'tldraw.com',
  '*.tldraw.com',
  'trello.com',
  '*.trello.com',
  'typeform.com',
  '*.typeform.com',
  'val.town',
  '*.val.town',
  'vimeo.com',
  '*.vimeo.com',
  'pinterest.com',
  '*.pinterest.com',
  'whimsical.com',
  '*.whimsical.com',
  'youtube.com',
  '*.youtube.com',
  'youtu.be',
  '*.youtu.be',
  'nocodb.com',
  '*.nocodb.com',
]

export function isIframeUrlAllowed(url: string, customWhiteListDomains?: Array<string>) {
  let hostname

  try {
    hostname = new URL(url).hostname
  } catch {
    return false
  }

  const domains = [...allowedDomains, ...(customWhiteListDomains || [])]

  return domains.some((domain) => {
    if (domain.startsWith('*.')) {
      const baseDomain = domain.slice(2)
      return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)
    }
    return hostname === domain
  })
}
