import { openLink, useGlobal } from '#imports'

const useAttachment = () => {
  const { appInfo } = useGlobal()

  const getPossibleAttachmentSrc = (item: Record<string, any>) => {
    const res: string[] = []
    if (item?.data) res.push(item.data)
    if (item?.signedPath) res.push(`${appInfo.value.ncSiteUrl}/${item.signedPath}`)
    if (item?.signedUrl) res.push(item.signedUrl)
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
    // return signed url / original url / built url anyway
    // which we can extract from the sources array since it's ordered based on priority
    return sources[0]
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
