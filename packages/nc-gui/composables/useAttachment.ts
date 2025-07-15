import type { AttachmentType } from 'nocodb-sdk'
import { getI18n } from '~/plugins/a.i18n'

const useAttachment = () => {
  const { appInfo } = useGlobal()

  const { $api } = useNuxtApp()

  // `useAttachment` is used inside normal function of canvas table so we have to use `getI18n().global` instead of `useI18n`
  const { t } = getI18n().global

  const getPossibleAttachmentSrc = (item: Record<string, any>, thumbnail?: 'card_cover' | 'tiny' | 'small') => {
    const res: string[] = []

    if (thumbnail && item?.thumbnails && item.thumbnails[thumbnail]) {
      res.push(getPossibleAttachmentSrc(item.thumbnails[thumbnail])[0])
    }
    if (item?.data) res.push(item.data)
    if (item?.file) res.push(window.URL.createObjectURL(item.file))
    if (item?.signedPath) res.push(`${appInfo.value.ncSiteUrl}/${encodeURI(item.signedPath)}`)
    if (item?.signedUrl) res.push(item.signedUrl)
    if (item?.path) res.push(`${appInfo.value.ncSiteUrl}/${encodeURI(item.path)}`)
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
        const res = await fetch(source, { method: 'HEAD', mode: 'no-cors' })
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

  async function batchUploadFiles(files: FileList | File[], path: string) {
    if (!files.length) return []

    const chunkSize = 10

    // Convert FileList to Array if necessary
    const fileArray: File[] = ncIsArray(files) ? files : Array.from(files)

    const uploadedFiles: AttachmentType[] = []

    try {
      while (fileArray.length) {
        const chunk = fileArray.splice(0, chunkSize)

        const uploadedFilesChunk = await $api.storage.upload(
          {
            path,
          },
          {
            files: chunk,
          },
        )

        uploadedFiles.push(...uploadedFilesChunk)
      }

      return uploadedFiles
    } catch (e: any) {
      message.error((await extractSdkResponseErrorMsg(e)) || t('msg.error.internalError'))

      return []
    }
  }

  return {
    getAttachmentSrc,
    getPossibleAttachmentSrc,
    openAttachment,
    batchUploadFiles,
  }
}

export default useAttachment
