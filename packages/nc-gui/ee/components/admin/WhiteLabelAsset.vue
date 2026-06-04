<script lang="ts" setup>
import { PublicAttachmentScope } from 'nocodb-sdk'

/**
 * White-label asset uploader — drag & drop or browse, with preview + replace /
 * remove. Uploads to the public WHITELABEL scope and emits the resulting URL.
 * Used for the light/dark logos and the favicon.
 */
interface Props {
  modelValue: string | null
  /** Upload path segment + a stable id for the slot (e.g. 'logoUrl'). */
  pathKey: string
  accept: string
  previewBg?: 'light' | 'dark'
  /** Sizing classes for the preview / dropzone box. */
  boxClass?: string
  /** Sub-text shown in the empty dropzone (non-compact only). */
  emptyHint?: string
  /** Compact = small square zone (favicon): icon + "Upload" only, no drag copy. */
  compact?: boolean
  maxSizeMb?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  previewBg: 'light',
  boxClass: '',
  emptyHint: '',
  compact: false,
  maxSizeMb: 2,
})

const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const { appInfo } = useGlobal()

const { $api } = useNuxtApp()

const { t } = useI18n()

const dropZoneRef = ref<HTMLDivElement>()

const fileInput = ref<HTMLInputElement>()

const uploading = ref(false)

const maxBytes = computed(() => props.maxSizeMb * 1024 * 1024)

// In dev the frontend (:3000) and backend (:8080) differ; a bare `/dltemp/...`
// would resolve against the frontend origin and 404. Join with ncSiteUrl.
function joinSiteUrl(url: string | null): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (typeof window === 'undefined') return url
  const base = new URL(appInfo.value?.ncSiteUrl || '/', window.location.origin)
  return new URL(url, base).toString()
}

const previewSrc = computed(() => joinSiteUrl(props.modelValue))

async function uploadAsset(file: File) {
  // `accept` is only a hint — the OS picker's "All files" option and drag-and-drop
  // both bypass it. Enforce by BLOCKING svg (the actual XSS risk) rather than an
  // allowlist: browsers report `.ico` inconsistently (image/x-icon vs
  // image/vnd.microsoft.icon vs application/x-icon), so an allowlist would
  // false-reject valid favicons. Check both the reported type and the filename.
  if (file.type === 'image/svg+xml' || /\.svgz?$/i.test(file.name)) {
    message.error(t('labels.whiteLabel.unsupportedFileType'))
    return
  }

  if (file.size > maxBytes.value) {
    message.error(t('labels.whiteLabel.fileTooLarge', { size: props.maxSizeMb }))
    return
  }

  uploading.value = true
  try {
    const result = await $api.storage.upload(
      {
        path: ['noco', 'whiteLabel', props.pathKey].join('/'),
        scope: PublicAttachmentScope.WHITELABEL,
      },
      { files: [file] as unknown as Blob[] },
    )
    const attachment = (result as any[])?.[0]
    // signedPath is a /dltemp/... URL that renders inline; the backend converts
    // it to the canonical download path on save and re-signs on read.
    const raw = attachment?.signedPath ?? attachment?.url
    if (!raw) {
      message.error(t('labels.whiteLabel.uploadNoUrl'))
      return
    }
    // Local storage returns `dltemp/...` without a leading slash; force absolute.
    emit('update:modelValue', /^(https?:\/\/|\/)/.test(raw) ? raw : `/${raw}`)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    uploading.value = false
  }
}

async function onDrop(files: File[] | null) {
  const file = files?.[0]
  if (file) await uploadAsset(file)
}

const { isOverDropZone } = useDropZone(dropZoneRef, onDrop)

async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset so re-selecting the same file fires another change event.
  input.value = ''
  if (file) await uploadAsset(file)
}

function pickFile() {
  fileInput.value?.click()
}

function remove() {
  emit('update:modelValue', null)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Filled: preview with hover/focus action overlay -->
    <div
      v-if="modelValue"
      class="group relative rounded-lg border-1 border-nc-border-gray-medium overflow-hidden flex items-center justify-center"
      :class="[boxClass, previewBg === 'dark' ? 'bg-gray-800' : 'bg-white']"
    >
      <img :src="previewSrc" alt="" class="max-w-full max-h-full object-contain p-2" />

      <!-- Loading overlay -->
      <div v-if="uploading" class="absolute inset-0 flex items-center justify-center bg-black/20">
        <GeneralLoader size="large" />
      </div>

      <!-- Action overlay — revealed on hover / keyboard focus -->
      <div
        v-else
        class="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <NcTooltip :title="$t('general.replace')">
          <button
            type="button"
            class="flex items-center justify-center h-8 w-8 rounded-lg bg-white/90 text-nc-content-gray hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            @click="pickFile"
          >
            <GeneralIcon icon="ncEdit" class="h-4 w-4" />
          </button>
        </NcTooltip>
        <NcTooltip :title="$t('general.remove')">
          <button
            type="button"
            class="flex items-center justify-center h-8 w-8 rounded-lg bg-white/90 text-nc-content-red-medium hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            @click="remove"
          >
            <GeneralIcon icon="ncTrash2" class="h-4 w-4" />
          </button>
        </NcTooltip>
      </div>
    </div>

    <!-- Empty: dropzone -->
    <div
      v-else
      ref="dropZoneRef"
      class="relative rounded-lg border-1 border-dashed border-nc-border-gray-medium flex flex-col items-center justify-center cursor-pointer transition-colors text-center px-3"
      :class="[boxClass, { '!border-nc-border-brand bg-nc-bg-brand': isOverDropZone }]"
      @click="pickFile"
    >
      <div v-if="uploading" class="absolute inset-0 flex items-center justify-center">
        <GeneralLoader size="large" />
      </div>
      <template v-else>
        <GeneralIcon icon="ncUpload" class="text-nc-content-gray-muted" :class="compact ? 'h-5 w-5' : 'h-6 w-6 mb-2'" />
        <span v-if="compact" class="text-nc-content-brand text-bodySm font-medium">{{ $t('general.upload') }}</span>
        <template v-else>
          <div class="text-nc-content-gray-subtle2">
            {{ $t('labels.whiteLabel.dragDropPrefix') }}
            <span class="text-nc-content-brand font-medium">{{ $t('labels.whiteLabel.browse') }}</span>
          </div>
          <div v-if="emptyHint" class="text-nc-content-gray-muted text-bodySm mt-1">
            {{ emptyHint }}
          </div>
        </template>
      </template>
    </div>

    <input ref="fileInput" type="file" :accept="accept" class="hidden" @change="onFileSelected" />
  </div>
</template>
