export const replaceUrlsWithLink = (text: string): boolean | string => {
  if (!text) {
    return false
  }

  const rawText = text.toString()
  let found = false
  const out = rawText.replace(/URI::\((.*?)\)/g, (_, url) => {
    found = true
    const a = document.createElement('a')
    a.textContent = url
    a.setAttribute('href', url)
    a.setAttribute('target', '_blank')
    return a.outerHTML
  })

  return found && out
}

export const dashboardUrl = () => {
  return `${location.origin}${location.pathname || ''}`
}

// ref : https://stackoverflow.com/a/5717133
export const isValidURL = (str: string) => {
  const pattern =
    /^(?:(?:https?|ftp):\/\/)?(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00A1-\uFFFF0-9]-*)*[a-z\u00A1-\uFFFF0-9]+)(?:\.(?:[a-z\u00A1-\uFFFF0-9]-*)*[a-z\u00A1-\uFFFF0-9]+)*(?:\.(?:[a-z\u00A1-\uFFFF]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?$/i
  return !!pattern.test(str)
}

export const openLink = (url: string, target = '_blank') => {
  window.open(url, target)
}
