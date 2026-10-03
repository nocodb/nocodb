<script setup lang="ts">
import type { FormBuilderAttachmentItem, FormBuilderAttachmentsElement, VariableDefinition } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { WorkflowComposeDropInj } from '~/context'
import { splitWorkflowTemplate } from '~/utils/workflowUtils'
import { WorkflowVariablePicker } from '~/helpers/tiptap-markdown/extensions'

interface NodeGroup {
  nodeId: string
  nodeTitle: string
  category?: string
  variables: VariableDefinition[]
}

interface Props {
  element: FormBuilderAttachmentsElement
  modelValue?: FormBuilderAttachmentItem[] | null
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  disabled: false,
})

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const { $api } = useNuxtApp()

const route = useRoute()

const { activeProjectId } = storeToRefs(useBases())

const { openAttachment } = useAttachment()

const { t } = useI18n()

const workflowContext = inject(WorkflowVariableInj, null)

const composeDrop = inject(WorkflowComposeDropInj, null)

const items = computed<FormBuilderAttachmentItem[]>(() => (Array.isArray(vModel.value) ? vModel.value : []))

const setItems = (next: FormBuilderAttachmentItem[]) => {
  vModel.value = next.length ? next : null
}

const maxItems = computed(() => props.element.maxItems ?? 10)

const atLimit = computed(() => items.value.length >= maxItems.value)

const limitHint = computed(() => t('msg.info.attachmentsLimit', { count: maxItems.value }))

const allowUpload = computed(() => props.element.allowUpload !== false)

const allowUrl = computed(() => props.element.allowUrl !== false)

const selectedNodeId = computed(() => workflowContext?.selectedNodeId?.value ?? null)

const canDropFiles = computed(() => !props.disabled && allowUpload.value)

// Lookups carry the type they resolve to; a Lookup of an Attachment field holds files too.
function isAttachmentVariable(variable: VariableDefinition) {
  const extra = variable.extra
  return extra?.uiType === UITypes.Attachment || (extra?.uiType === UITypes.Lookup && extra?.lookupUiType === UITypes.Attachment)
}

// A list output describes its items in `itemSchema` (keys relative to one item). Expose them as
// children whose expression maps over the list, so a pick attaches the files of every item.
function itemSchemaChildren(variable: VariableDefinition): VariableDefinition[] {
  const schema = variable.extra?.itemSchema
  if (!schema?.length) return []
  const mapped = (child: VariableDefinition): VariableDefinition => ({
    ...child,
    key: `${variable.key}.map(item => item.${child.key})`,
    children: child.children?.map(mapped),
  })
  return schema.filter((child) => child.key).map(mapped)
}

// Attachment-typed variables only, flattened within their node group: every row is a pickable file
// list (no Record › Fields drill-down whose Select would attach a non-file), with its path as the
// description and its top-level group kept so it lands under the same heading.
function pickAttachmentVariables(variables: VariableDefinition[], path: string[] = [], groupKey?: string): VariableDefinition[] {
  return variables.flatMap((variable) => {
    const group = groupKey ?? variable.groupKey
    if (isAttachmentVariable(variable)) {
      return [
        {
          ...variable,
          children: undefined,
          groupKey: group,
          ...(path.length ? { extra: { ...variable.extra, description: path.join(' › ') } } : {}),
        },
      ]
    }
    const nested = [...(variable.children ?? []), ...itemSchemaChildren(variable)]
    return nested.length ? pickAttachmentVariables(nested, [...path, variable.name], group) : []
  })
}

const groupedAttachmentVariables = computed<NodeGroup[]>(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariables) return []
  return workflowContext
    .getAvailableVariables(selectedNodeId.value)
    .map((group) => ({ ...group, variables: pickAttachmentVariables(group.variables) }))
    .filter((group) => group.variables.length)
})

const flatAttachmentVariables = computed(() => groupedAttachmentVariables.value.flatMap((group) => group.variables))

// Every variable, for building a URL from step outputs (a URL field, a record id…).
const groupedUrlVariables = computed<NodeGroup[]>(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariables) return []
  return workflowContext.getAvailableVariables(selectedNodeId.value)
})

const flatUrlVariables = computed<VariableDefinition[]>(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariablesFlat) return []
  return workflowContext.getAvailableVariablesFlat(selectedNodeId.value)
})

// One dropdown anchored to the Add button; its overlay is whichever step is active.
type Panel = 'menu' | 'picker' | 'url'

const panel = ref<Panel | null>(null)

// The URL field's variable picker renders on `body`, outside the dropdown; a click there must
// not read as a click outside the URL popover.
let pointerInVariablePicker = false

useEventListener(
  document,
  'pointerdown',
  (event: PointerEvent) => {
    pointerInVariablePicker = !!(event.target as HTMLElement | null)?.closest?.('.tippy-box')
  },
  { capture: true },
)

const dropdownVisible = computed({
  get: () => panel.value !== null,
  set: (visible: boolean) => {
    if (!visible && panel.value === 'url' && pointerInVariablePicker) return
    panel.value = visible ? panel.value ?? 'menu' : null
  },
})

const closePanel = () => {
  panel.value = null
}

const addVariable = ({ label, expression }: { id: string; label: string; expression: string }) => {
  setItems([...items.value, { type: 'variable', expression, label }])
  closePanel()
}

const removeItem = (index: number) => {
  setItems(items.value.filter((_, i) => i !== index))
}

// ── URL popover ────────────────────────────────────────────────────────────

const urlInputRef = ref()

const urlValue = ref('')

const urlError = ref<string | null>(null)

const parseHttpUrl = (value: string): URL | null => {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

const isTemplatedUrl = (value: string) => value.includes('{{')

// A templated URL is stored as typed (encoding would break the `{{ }}`); only a literal
// prefix before the first template must already look like http(s).
const normaliseUrl = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (isTemplatedUrl(trimmed)) {
    const prefix = trimmed.slice(0, trimmed.indexOf('{{'))
    return !prefix || /^https?:\/\//i.test(prefix) ? trimmed : null
  }
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return parseHttpUrl(trimmed)?.href ?? null
  // `example.com/report.pdf` is what people paste; assume https rather than reject it.
  const url = parseHttpUrl(`https://${trimmed}`)
  return url?.hostname.includes('.') && !url.username ? url.href : null
}

const urlIsValid = computed(() => !!normaliseUrl(urlValue.value))

const openUrlPopover = () => {
  urlValue.value = ''
  urlError.value = null
  panel.value = 'url'
  nextTick(() => urlInputRef.value?.focus?.())
}

const addUrl = () => {
  const url = normaliseUrl(urlValue.value)
  if (!url) {
    urlError.value = t('msg.error.attachmentInvalidUrl')
    return
  }
  if (items.value.some((item) => item.type === 'url' && item.url === url)) {
    urlError.value = t('msg.error.attachmentAlreadyAttached')
    return
  }
  setItems([...items.value, { type: 'url', url }])
  closePanel()
}

watch(urlValue, () => {
  urlError.value = null
})

const urlFileName = (value: string) => {
  const url = parseHttpUrl(value)
  if (!url) return value
  const last = url.pathname.split('/').filter(Boolean).pop()
  if (!last) return url.hostname
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

const urlHost = (value: string) => parseHttpUrl(value)?.hostname ?? ''

// ── Upload ─────────────────────────────────────────────────────────────────

const fileInput = ref<HTMLInputElement>()

const isUploading = ref(false)

const triggerUpload = () => {
  closePanel()
  fileInput.value?.click()
}

const uploadFiles = async (selected: File[]) => {
  if (!canDropFiles.value) return

  if (isUploading.value) {
    message.info(t('msg.info.attachmentUploadInProgress'))
    return
  }

  // Same name and size as a file already uploaded here: the recipient would get it twice.
  const isAttached = (file: File) =>
    items.value.some((item) => item.type === 'file' && item.title === file.name && item.size === file.size)
  const fresh = selected.filter((file) => !isAttached(file))
  if (fresh.length < selected.length) message.info(t('msg.error.attachmentAlreadyAttached'))

  const files = fresh.slice(0, Math.max(0, maxItems.value - items.value.length))
  if (files.length < fresh.length) message.info(limitHint.value)

  if (!files.length) return

  // Uploaded files are known up front; block a set this node's provider could never send.
  const maxTotalBytes = props.element.maxTotalBytes
  if (maxTotalBytes) {
    const uploaded = items.value.reduce((sum, item) => sum + (item.type === 'file' ? item.size ?? 0 : 0), 0)
    const adding = files.reduce((sum, file) => sum + file.size, 0)
    if (uploaded + adding > maxTotalBytes) {
      message.error(t('msg.error.attachmentsTooLarge', { size: getReadableFileSize(maxTotalBytes) }))
      return
    }
  }

  const workflowId = route.params.workflowId as string | undefined

  if (!activeProjectId.value || !workflowId) {
    message.error(t('msg.error.attachmentOpenWorkflowToUpload'))
    return
  }

  isUploading.value = true

  try {
    const formData = new FormData()
    for (const file of files) formData.append('files', file)

    const { data } = await $api.instance.post<
      Array<{ id?: string; title: string; mimetype: string; size: number; path?: string; url?: string }>
    >(`/api/v2/meta/bases/${activeProjectId.value}/workflows/${workflowId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    setItems([
      ...items.value,
      ...data.map<FormBuilderAttachmentItem>((attachment) => ({
        type: 'file',
        ...(attachment.id ? { id: attachment.id } : {}),
        title: attachment.title,
        mimetype: attachment.mimetype,
        size: attachment.size,
        ...(attachment.path ? { path: attachment.path } : {}),
        ...(attachment.url ? { url: attachment.url } : {}),
      })),
    ])
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUploading.value = false
  }
}

const onFilesSelected = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  uploadFiles(files)
}

// The compose modal shows its drop target only while an editable, upload-enabled input is mounted.
if (composeDrop) {
  watch(
    canDropFiles,
    (canDrop) => {
      if (canDrop) composeDrop.value = uploadFiles
      else if (composeDrop.value === uploadFiles) composeDrop.value = null
    },
    { immediate: true },
  )
  onBeforeUnmount(() => {
    if (composeDrop.value === uploadFiles) composeDrop.value = null
  })
}

// ── Open ───────────────────────────────────────────────────────────────────

const isOpenable = (item: FormBuilderAttachmentItem) =>
  item.type === 'file' || (item.type === 'url' && !isTemplatedUrl(item.url) && !!parseHttpUrl(item.url))

// URLs open as-is; uploaded files are stored by path, so the backend signs a fresh link first.
const openItem = async (item: FormBuilderAttachmentItem) => {
  if (item.type === 'url') {
    const url = parseHttpUrl(item.url)
    if (url) window.open(url.href, '_blank', 'noopener,noreferrer')
    return
  }
  if (item.type !== 'file') return

  const workflowId = route.params.workflowId as string | undefined
  if (!activeProjectId.value || !workflowId) return

  try {
    const { data } = await $api.instance.post<Array<Record<string, any>>>(
      `/api/v2/meta/bases/${activeProjectId.value}/workflows/${workflowId}/attachments/sign`,
      { attachments: [{ path: item.path, url: item.url, title: item.title, mimetype: item.mimetype }] },
    )
    if (!data?.[0]) {
      message.error(t('msg.error.attachmentNoLongerAvailable'))
      return
    }
    await openAttachment(data[0])
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// ── Chip presentation ──────────────────────────────────────────────────────

const chipIcon = (item: FormBuilderAttachmentItem) => {
  if (item.type === 'variable') return 'ncPaperclip'
  if (item.type === 'file') return getAttachmentIcon(item.title, item.mimetype)
  return 'ncLink'
}

// A templated URL reads as its variables (pills) rather than raw `{{ }}`; hover shows the text.
const templateSegments = (item: FormBuilderAttachmentItem) =>
  item.type === 'url' && isTemplatedUrl(item.url) ? splitWorkflowTemplate(item.url, flatUrlVariables.value) : null

const chipName = (item: FormBuilderAttachmentItem) => {
  if (item.type === 'variable') return item.label
  if (item.type === 'file') return item.title
  return urlFileName(item.url)
}

const chipMeta = (item: FormBuilderAttachmentItem) => {
  if (item.type === 'variable') return t('labels.attachmentFieldChip')
  if (item.type === 'file') return getReadableFileSize(item.size)
  return urlHost(item.url)
}

const chipTooltip = (item: FormBuilderAttachmentItem) => {
  if (item.type === 'variable') return item.expression
  if (item.type === 'file') return item.title
  const segments = templateSegments(item)
  return segments ? segments.map((segment) => (segment.label ? `{${segment.label}}` : segment.text)).join('') : item.url
}
</script>

<template>
  <div class="nc-form-builder-attachments flex flex-col gap-2">
    <div v-if="items.length" class="flex flex-wrap gap-2">
      <NcTooltip
        v-for="(item, index) in items"
        :key="index"
        placement="bottomLeft"
        :show-on-truncate-only="item.type === 'file'"
        truncate-selector=".nc-attachment-chip-name"
        class="nc-attachment-chip group flex items-center gap-2 h-8 px-2.5 rounded-md border-1 border-nc-border-gray-medium bg-nc-bg-default hover:bg-nc-bg-gray-extralight min-w-0 max-w-[240px] text-[13px]"
        :class="{ 'cursor-pointer': isOpenable(item) }"
        @click="isOpenable(item) && openItem(item)"
      >
        <template #title>
          <span :class="{ 'font-mono text-xs break-all': item.type === 'url' }">{{ chipTooltip(item) }}</span>
        </template>
        <!-- File-type glyphs carry their own padding; the paperclip and link glyphs don't, so they run a step smaller to match. -->
        <GeneralIcon
          :icon="chipIcon(item)"
          class="flex-none"
          :class="item.type === 'file' ? 'w-4 h-4 text-nc-content-brand' : 'w-3.5 h-3.5 text-nc-content-gray-subtle'"
        />
        <span
          v-if="templateSegments(item)"
          class="nc-attachment-chip-name nc-attachment-chip-template truncate text-nc-content-gray-emphasis min-w-[4ch]"
        >
          <template v-for="(segment, segmentIndex) in templateSegments(item)" :key="segmentIndex">
            <span v-if="segment.label" class="nc-attachment-chip-variable">{{ segment.label }}</span>
            <template v-else>{{ segment.text }}</template>
          </template>
        </span>
        <template v-else>
          <span class="nc-attachment-chip-name truncate text-nc-content-gray-emphasis min-w-[4ch]">{{ chipName(item) }}</span>
          <span class="text-nc-content-gray-muted flex-none truncate max-w-[55%]">{{ chipMeta(item) }}</span>
        </template>
        <button
          v-if="!disabled"
          type="button"
          class="nc-attachment-chip-remove flex-none flex items-center justify-center w-3.5 h-3.5 -mr-1 rounded text-nc-content-gray-muted hover:text-nc-content-gray opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          :aria-label="$t('labels.removeAttachment')"
          @click.stop="removeItem(index)"
        >
          <GeneralIcon icon="close" class="w-3.5 h-3.5" />
        </button>
      </NcTooltip>
    </div>

    <div class="flex items-center gap-2">
      <NcDropdown v-model:visible="dropdownVisible" :trigger="['click']" :disabled="disabled || atLimit" placement="bottomLeft">
        <NcTooltip :disabled="!atLimit || disabled" placement="right">
          <template #title>{{ limitHint }}</template>
          <NcButton type="text" size="small" :disabled="disabled || atLimit" :loading="isUploading">
            <div class="flex items-center gap-1">
              <GeneralIcon icon="plus" />
              <span>{{ $t('labels.addAttachment') }}</span>
            </div>
          </NcButton>
        </NcTooltip>

        <template #overlay>
          <NcMenu v-if="panel === 'menu'">
            <NcTooltip :disabled="!!flatAttachmentVariables.length" placement="right">
              <template #title>{{ $t('msg.info.noAttachmentFieldsAvailable') }}</template>
              <NcMenuItem :disabled="!flatAttachmentVariables.length" @click="panel = 'picker'">
                <div class="flex items-center gap-2 text-[13px]">
                  <GeneralIcon icon="cellAttachment" class="w-4 h-4" />
                  <span>{{ $t('labels.fromAttachmentField') }}</span>
                </div>
              </NcMenuItem>
            </NcTooltip>
            <NcMenuItem v-if="allowUpload" @click="triggerUpload">
              <div class="flex items-center gap-2 text-[13px]">
                <GeneralIcon icon="ncUpload" class="w-4 h-4" />
                <span>{{ $t('labels.uploadFile') }}</span>
              </div>
            </NcMenuItem>
            <NcMenuItem v-if="allowUrl" @click="openUrlPopover">
              <div class="flex items-center gap-2 text-[13px]">
                <GeneralIcon icon="ncLink" class="w-4 h-4" />
                <span>{{ $t('labels.fromUrl') }}</span>
              </div>
            </NcMenuItem>
          </NcMenu>

          <div v-else-if="panel === 'picker'" @click.stop>
            <WorkflowVariablePicker
              :items="flatAttachmentVariables"
              :grouped-items="groupedAttachmentVariables"
              :command="addVariable"
            />
          </div>

          <div v-else-if="panel === 'url'" class="nc-attach-url-popover w-[420px] p-3.5 pb-3" @click.stop>
            <div class="flex items-center gap-2 mb-2.5 text-[13px] font-semibold text-nc-content-gray-emphasis">
              <GeneralIcon icon="ncLink" class="w-4 h-4 text-nc-content-gray-subtle" />
              <span>{{ $t('labels.attachFromUrl') }}</span>
            </div>
            <div class="flex gap-2 items-stretch">
              <div
                class="nc-attach-url-input flex-1 min-w-0"
                :class="{ 'nc-attach-url-input-error': urlError }"
                @keydown.esc.stop="closePanel"
              >
                <NcFormBuilderInputWorkflowInput
                  ref="urlInputRef"
                  v-model="urlValue"
                  :placeholder="$t('placeholder.attachmentUrl')"
                  :variables="flatUrlVariables"
                  :grouped-variables="groupedUrlVariables"
                  picker-placement="below"
                  @enter="addUrl"
                />
              </div>
              <NcButton type="primary" size="small" class="!h-auto !px-4" :disabled="!urlIsValid" @click="addUrl">{{
                $t('general.add')
              }}</NcButton>
            </div>
            <div class="mt-2 text-xs" :class="urlError ? 'text-nc-content-red-medium' : 'text-nc-content-gray-muted'">
              {{ urlError || $t('msg.info.attachmentUrlHint') }}
            </div>
          </div>
        </template>
      </NcDropdown>
    </div>

    <input ref="fileInput" type="file" multiple style="display: none" @change="onFilesSelected" />
  </div>
</template>

<style lang="scss" scoped>
.nc-attach-url-input-error :deep(.ProseMirror) {
  @apply !border-nc-border-red;
}

// Same look as the editor's expression chips.
.nc-attachment-chip-variable {
  @apply bg-nc-bg-brand text-nc-content-brand rounded px-1.5 py-0.25 mx-0.5 text-small whitespace-nowrap;
}
</style>
