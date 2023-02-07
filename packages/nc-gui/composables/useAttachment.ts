const useAttachment = () => {
  const { appInfo } = useGlobal()

  const getAttachmentSrc = (item: Record<string, any>) => {
    if (item.data) {
      return item.data
    } else if (item.path) {
      return `${appInfo.value.ncSiteUrl}/${item.path}`
    }
    return item.url
  }

  const showFallback = (evt: any, item: Record<string, any>) => {
    evt.onerror = null
    evt.target.src = item.url
  }

  return {
    getAttachmentSrc,
    showFallback,
  }
}

export default useAttachment
