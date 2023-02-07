const useAttachment = () => {
  const { appInfo } = useGlobal()

  // TODO: not hardcode _nuxt
  const fileNotFoundImgSrc = `/_nuxt/assets/img/file-not-found.png`

  const getAttachmentSrc = (item: Record<string, any>) => {
    if (item?.data) {
      return item.data
    } else if (item?.path) {
      return `${appInfo.value.ncSiteUrl}/${item.path}`
    } else if (item?.url) {
      return item.url
    }
    return fileNotFoundImgSrc
  }

  // try `${appInfo.value.ncSiteUrl}/${item.path}`
  // if it fails -> try item.url
  // if it fails -> use default image
  const showFallback = async (evt: any, item: Record<string, any>) => {
    const possibleSources = [`${appInfo.value.ncSiteUrl}/${item.path}`, item.url, fileNotFoundImgSrc]
    evt.onerror = null
    const i = possibleSources.indexOf(evt.target.getAttribute('src'))
    if (i === -1) return
    evt.target.src = possibleSources[i + 1]
  }

  const getBackgroundImage = (item: Record<string, any>) => {
    return `url('${getAttachmentSrc(item)}'), url(${item.url}), url(${fileNotFoundImgSrc})`
  }

  return {
    getAttachmentSrc,
    getBackgroundImage,
    fileNotFoundImgSrc,
    showFallback,
  }
}

export default useAttachment
