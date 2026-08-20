<script setup lang="ts">
import type { AttachmentType } from 'nocodb-sdk'

interface Props {
  attachments?: AttachmentType[]
  editable?: boolean
  // Set for posted comments — enables serving each file through the
  // authenticated attachment proxy (no signed URLs). Omitted for pending
  // (not-yet-saved) attachments in the composer.
  commentId?: string
}

const props = withDefaults(defineProps<Props>(), {
  attachments: () => [],
  editable: false,
  commentId: undefined,
})

const emits = defineEmits<{
  remove: [index: number]
}>()

const { attachments, editable, commentId } = toRefs(props)

const { appInfo, token } = useGlobal()

const { getPossibleAttachmentSrc, openAttachment } = useAttachment()

const meta = inject(MetaInj, ref())

const baseId = computed(() => meta.value?.base_id)

// Track blob: URLs created via createObjectURL so we can revoke them — both
// the previous batch when imageSrcs recomputes and any leftovers on unmount.
// Without this each recompute (attachments change, thread reload) leaks URLs.
const objectUrls = new Set<string>()

function trackObjectUrl(url: string): string {
  objectUrls.add(url)
  return url
}

function revokeObjectUrl(url?: string) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
    objectUrls.delete(url)
  }
}

// Files attached to a saved comment carry a FileReference id and are served
// through the cookie/header-authenticated proxy — same mechanism docs use.
// An <img> tag can't send the auth header itself, so we fetch + blob.
function buildProxyUrl(item: AttachmentType): string {
  if (!item.id || !commentId.value || !baseId.value) return ''
  return `${appInfo.value.ncSiteUrl}/api/v2/data/bases/${baseId.value}/comments/${
    commentId.value
  }/attachment/${encodeURIComponent(item.id)}`
}

async function resolveSrc(item: AttachmentType): Promise<string> {
  const proxyUrl = buildProxyUrl(item)
  if (proxyUrl) {
    try {
      const response = await fetch(proxyUrl, { headers: { 'xc-auth': token.value || '' } })
      if (response.ok) return trackObjectUrl(URL.createObjectURL(await response.blob()))
    } catch {
      // fall through to the preview source below
    }
  }
  // Pending (just-uploaded) attachment — use the upload preview source.
  return getPossibleAttachmentSrc(item, 'tiny')[0] || getPossibleAttachmentSrc(item)[0] || ''
}

// Resolve thumbnail sources for image attachments (by index).
const imageSrcs = computedAsync(async () => {
  const out: Record<number, string> = {}
  await Promise.all(
    attachments.value.map(async (item, index) => {
      if (!isImage(item.title!, item.mimetype)) return
      out[index] = await resolveSrc(item)
    }),
  )
  return out
}, {})

async function onOpen(item: AttachmentType) {
  if ((item as any).status === 'uploading') return

  const proxyUrl = buildProxyUrl(item)
  if (proxyUrl) {
    const src = await resolveSrc(item)
    if (src) openLink(src)
    return
  }

  openAttachment(item)
}

// When imageSrcs recomputes, the previous result's blob URLs are orphaned —
// revoke them so they don't accumulate (resolveSrc always mints fresh ones).
watch(imageSrcs, (_newSrcs, oldSrcs) => {
  if (!oldSrcs) return
  for (const src of Object.values(oldSrcs)) revokeObjectUrl(src)
})

onBeforeUnmount(() => {
  for (const url of objectUrls) URL.revokeObjectURL(url)
  objectUrls.clear()
})
</script>

<template>
  <div
    v-if="attachments?.length"
    class="nc-comment-attachments grid gap-2"
    :style="{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }"
  >
    <div
      v-for="(item, index) in attachments"
      :key="`${item.id || item.title}-${index}`"
      class="nc-comment-attachment group relative flex items-center gap-2 min-w-0 border-1 border-nc-border-gray-medium rounded-lg bg-nc-bg-elevated px-2 py-1.5 cursor-pointer hover:bg-nc-bg-gray-light transition-colors"
      @click="onOpen(item)"
    >
      <img
        v-if="isImage(item.title!, item.mimetype) && imageSrcs[index]"
        :src="imageSrcs[index]"
        :alt="item.title"
        class="h-7 w-7 flex-none rounded object-cover"
      />
      <GeneralIcon v-else :icon="getAttachmentIcon(item.title, item.mimetype)" class="h-7 w-7 flex-none" />

      <div class="flex flex-col min-w-0 overflow-hidden">
        <NcTooltip show-on-truncate-only class="truncate text-small leading-4 text-nc-content-gray">
          <template #title>{{ item.title }}</template>
          {{ item.title }}
        </NcTooltip>
        <span v-if="item.size" class="text-tiny leading-4 text-nc-content-gray-muted">
          {{ getReadableFileSize(item.size) }}
        </span>
      </div>

      <NcButton
        v-if="editable"
        type="text"
        size="xxsmall"
        class="nc-comment-attachment-remove !absolute -top-2 -right-2 !flex !bg-nc-bg-elevated !border-1 !border-nc-border-gray-medium !rounded-full !h-5 !w-5 !shadow-sm"
        data-testid="nc-comment-attachment-remove"
        @click.stop="emits('remove', index)"
      >
        <GeneralIcon icon="close" class="text-tiny" />
      </NcButton>
    </div>
  </div>
</template>
