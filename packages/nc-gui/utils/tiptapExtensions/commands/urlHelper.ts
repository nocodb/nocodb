const youtubeUrlToId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

export const youtubeUrlToEmbedUrl = (url: string) => {
  const youtubeId = youtubeUrlToId(url)
  return `https://www.youtube.com/embed/${youtubeId}`
}
