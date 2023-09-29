import { openLink, useGlobal } from '#imports'

const useAttachment = () => {
  const { appInfo } = useGlobal()

  const getPossibleAttachmentSrc = (item: Record<string, any>) => {
    const res: string[] = []
    if (item?.data) res.push(item.data)
    if (item?.path) res.push(`${appInfo.value.ncSiteUrl}/${item.path}`)
    if (item?.url) res.push(item.url)
    return res
  }

  const getAttachmentSrc = async (item: Record<string, any>) => {
    if (item?.data) {
      return item.data
    }
    const sources = getPossibleAttachmentSrc(item)
    for (const source of sources) {
      try {
        // test if the source is accessible or not
        const res = await fetch(source, { method: 'HEAD' })
        if (res.ok) {
          return source
        }
      } catch {}
    }
    // if no source can be fetched, it could be probably blocked by CORS
    // return original url or built url anyway
    return item.url || `${appInfo.value.ncSiteUrl}/${item.path}`
  }

  const openAttachment = async (item: Record<string, any>) => {
    openLink(await getAttachmentSrc(item))
  }

  return {
    getAttachmentSrc,
    getPossibleAttachmentSrc,
    openAttachment,
  }
}

export default useAttachment
