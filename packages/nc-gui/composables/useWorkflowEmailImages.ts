import { EMAIL_FILE_IMAGE_SCHEME } from '~/helpers/tiptap-markdown/extensions/emailImage'

// Signed links outlive this by far (2h default); refreshing early avoids a broken image mid-edit.
const SIGNED_SRC_TTL_MS = 30 * 60 * 1000

// Shared across editor instances: the sidebar and compose-modal editors show the same images.
const signedSrcCache = new Map<string, { at: number; src: Promise<string | undefined> }>()

/**
 * Email body images live as workflow uploads (the attachments endpoint), referenced from the
 * body as `nc-file:<file_url>`. The bytes are loaded only at send time.
 */
export function useWorkflowEmailImages() {
  const { $api } = useNuxtApp()

  const { t } = useI18n()

  const route = useRoute()

  const { activeProjectId } = storeToRefs(useBases())

  const { getPossibleAttachmentSrc } = useAttachment()

  function endpoint(suffix = '') {
    const workflowId = route.params.workflowId as string | undefined
    if (!activeProjectId.value || !workflowId) return null
    return `/api/v2/meta/bases/${activeProjectId.value}/workflows/${workflowId}/attachments${suffix}`
  }

  /** Uploads `file` and returns the `src` to store in the body. Throws when it can't. */
  async function uploadImage(file: File): Promise<string> {
    const url = endpoint()
    if (!url) throw new Error(t('msg.error.emailImageNoWorkflow'))

    const formData = new FormData()
    formData.append('files', file)
    const { data } = await $api.instance.post<Array<{ path?: string; url?: string }>>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    const fileUrl = data?.[0]?.url || data?.[0]?.path
    if (!fileUrl) throw new Error(t('msg.error.emailImageUploadFailed'))
    return `${EMAIL_FILE_IMAGE_SCHEME}${fileUrl}`
  }

  /**
   * A displayable URL for a stored image `src`, or undefined when the file is gone (or the route
   * isn't ready). Rejects when the request itself fails, which says nothing about the file.
   */
  function resolveImageSrc(src: string): Promise<string | undefined> {
    const url = endpoint('/sign')
    // Per endpoint: signing is scoped to the base, so another base's answer must not carry over.
    const key = `${url}|${src}`
    const cached = signedSrcCache.get(key)
    if (cached && Date.now() - cached.at < SIGNED_SRC_TTL_MS) return cached.src

    const fileUrl = src.slice(EMAIL_FILE_IMAGE_SCHEME.length)
    const pending = url
      ? $api.instance
          .post<Array<Record<string, any>>>(url, {
            attachments: [/^https?:\/\//i.test(fileUrl) ? { url: fileUrl } : { path: fileUrl }],
          })
          .then(({ data }) => (data?.[0] ? getPossibleAttachmentSrc(data[0])[0] : undefined))
      : Promise.resolve(undefined)

    // Only a resolved link is kept: a miss or a failed request is asked again next time.
    signedSrcCache.set(key, { at: Date.now(), src: pending })
    const forget = () => {
      if (signedSrcCache.get(key)?.src === pending) signedSrcCache.delete(key)
    }
    pending.then((resolved) => {
      if (!resolved) forget()
    }, forget)
    return pending
  }

  return { uploadImage, resolveImageSrc }
}
