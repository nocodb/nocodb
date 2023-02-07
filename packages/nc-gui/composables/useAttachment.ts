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
  // if it fails -> try default image
  const showFallback = async (evt: any, item: Record<string, any>) => {
    evt.onerror = null
    if (item?.url) {
      await fetch(item.url)
        .then((res) => {
          if (!res.ok || res.headers.get('Content-Type') !== item.mimetype) {
            throw new Error('Failed to load the file')
          }
        })
        .then((_) => {
          evt.target.src = item.url
        })
        .catch((_) => {
          evt.target.src = fileNotFoundImgSrc
        })
    } else {
      evt.target.src = fileNotFoundImgSrc
    }
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
