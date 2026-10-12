<script setup lang="ts">
import type { FormBuilderAttachmentItem, FormBuilderAttachmentsElement, VariableDefinition } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
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

const workflowContext = inject(WorkflowVariableInj, null)

const items = computed<FormBuilderAttachmentItem[]>(() => (Array.isArray(vModel.value) ? vModel.value : []))

const setItems = (next: FormBuilderAttachmentItem[]) => {
  vModel.value = next.length ? next : null
}

const maxItems = computed(() => props.element.maxItems ?? 10)

const atLimit = computed(() => items.value.length >= maxItems.value)

const limitHint = computed(() => `Up to ${maxItems.value} files per email.`)

const allowUpload = computed(() => props.element.allowUpload !== false)

const allowUrl = computed(() => props.element.allowUrl !== false)

const selectedNodeId = computed(() => workflowContext?.selectedNodeId?.value ?? null)

// Attachment-typed variables only, kept in their node groups. A parent survives when a descendant
// qualifies (a linked record → its attachment fields); a matching field drops its children so a
// click picks the whole file list instead of drilling into `.length` and friends.
const pickAttachmentVariables = (variables: VariableDefinition[]): VariableDefinition[] =>
  variables.flatMap((variable) => {
    if (variable.extra?.uiType === UITypes.Attachment) return [{ ...variable, children: undefined }]
    const children = variable.children?.length ? pickAttachmentVariables(variable.children) : []
    return children.length ? [{ ...variable, children }] : []
  })

const groupedAttachmentVariables = computed<NodeGroup[]>(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariables) return []
  return workflowContext
    .getAvailableVariables(selectedNodeId.value)
    .map((group) => ({ ...group, variables: pickAttachmentVariables(group.variables) }))
    .filter((group) => group.variables.length)
})

const flatAttachmentVariables = computed(() => groupedAttachmentVariables.value.flatMap((group) => group.variables))

// One dropdown anchored to the Add button; its overlay is whichever step is active.
type Panel = 'menu' | 'picker' | 'url'

const panel = ref<Panel | null>(null)

const dropdownVisible = computed({
  get: () => panel.value !== null,
  set: (visible: boolean) => {
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

const urlIsValid = computed(() => !!parseHttpUrl(urlValue.value))

const openUrlPopover = () => {
  urlValue.value = ''
  urlError.value = null
  panel.value = 'url'
  nextTick(() => urlInputRef.value?.focus?.())
}

const addUrl = () => {
  const url = parseHttpUrl(urlValue.value)
  if (!url) {
    urlError.value = 'Enter a valid URL starting with http:// or https://'
    return
  }
  if (items.value.some((item) => item.type === 'url' && item.url === url.href)) {
    urlError.value = 'This file is already attached.'
    return
  }
  setItems([...items.value, { type: 'url', url: url.href }])
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

const onFilesSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? []).slice(0, Math.max(0, maxItems.value - items.value.length))
  input.value = ''

  if (!files.length) return

  const workflowId = route.params.workflowId as string | undefined

  if (!activeProjectId.value || !workflowId) {
    message.error('Open the workflow to upload files')
    return
  }

  isUploading.value = true

  try {
    const formData = new FormData()
    for (const file of files) formData.append('files', file)

    const { data } = await $api.instance.post<
      Array<{ title: string; mimetype: string; size: number; path?: string; url?: string }>
    >(`/api/v2/meta/bases/${activeProjectId.value}/workflows/${workflowId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    setItems([
      ...items.value,
      ...data.map<FormBuilderAttachmentItem>((attachment) => ({
        type: 'file',
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

// ── Open ───────────────────────────────────────────────────────────────────

const isOpenable = (item: FormBuilderAttachmentItem) => item.type === 'file' || item.type === 'url'

// URLs open as-is; uploaded files are stored by path, so the backend signs a fresh link first.
const openItem = async (item: FormBuilderAttachmentItem) => {
  if (item.type === 'url') {
    window.open(item.url, '_blank', 'noopener,noreferrer')
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
      message.error('This file is no longer available')
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

const chipName = (item: FormBuilderAttachmentItem) => {
  if (item.type === 'variable') return item.label
  if (item.type === 'file') return item.title
  return urlFileName(item.url)
}

const chipMeta = (item: FormBuilderAttachmentItem) => {
  if (item.type === 'variable') return 'field'
  if (item.type === 'file') return getReadableFileSize(item.size)
  return urlHost(item.url)
}

const chipTooltip = (item: FormBuilderAttachmentItem) => {
  if (item.type === 'variable') return item.expression
  if (item.type === 'file') return item.title
  return item.url
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
        <GeneralIcon
          :icon="chipIcon(item)"
          class="w-4 h-4 flex-none"
          :class="item.type === 'file' ? 'text-nc-content-brand' : 'text-nc-content-gray-subtle'"
        />
        <span class="nc-attachment-chip-name truncate text-nc-content-gray-emphasis">{{ chipName(item) }}</span>
        <span class="text-nc-content-gray-muted flex-none">{{ chipMeta(item) }}</span>
        <button
          v-if="!disabled"
          type="button"
          class="nc-attachment-chip-remove flex-none flex items-center justify-center w-3.5 h-3.5 -mr-1 rounded text-nc-content-gray-muted hover:text-nc-content-gray opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          aria-label="Remove attachment"
          @click.stop="removeItem(index)"
        >
          <GeneralIcon icon="close" class="w-3.5 h-3.5" />
        </button>
      </NcTooltip>
    </div>

    <div class="flex items-center gap-2">
      <NcDropdown v-model:visible="dropdownVisible" :trigger="['click']" :disabled="disabled" placement="bottomLeft">
        <NcButton type="text" size="small" :disabled="disabled" :loading="isUploading">
          <div class="flex items-center gap-1">
            <GeneralIcon icon="plus" />
            <span>Add attachment</span>
          </div>
        </NcButton>

        <template #overlay>
          <NcMenu v-if="panel === 'menu'">
            <NcTooltip :disabled="!atLimit" placement="right">
              <template #title>{{ limitHint }}</template>
              <NcMenuItem :disabled="atLimit || !flatAttachmentVariables.length" @click="panel = 'picker'">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="cellAttachment" class="w-4 h-4" />
                  <span>From attachment field</span>
                </div>
              </NcMenuItem>
            </NcTooltip>
            <NcTooltip v-if="allowUpload" :disabled="!atLimit" placement="right">
              <template #title>{{ limitHint }}</template>
              <NcMenuItem :disabled="atLimit" @click="triggerUpload">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="ncUpload" class="w-4 h-4" />
                  <span>Upload file</span>
                </div>
              </NcMenuItem>
            </NcTooltip>
            <NcTooltip v-if="allowUrl" :disabled="!atLimit" placement="right">
              <template #title>{{ limitHint }}</template>
              <NcMenuItem :disabled="atLimit" @click="openUrlPopover">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="ncLink" class="w-4 h-4" />
                  <span>From URL</span>
                </div>
              </NcMenuItem>
            </NcTooltip>
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
              <span>Attach from URL</span>
            </div>
            <div class="flex gap-2">
              <a-input
                ref="urlInputRef"
                v-model:value="urlValue"
                class="nc-attach-url-input flex-1 !rounded-lg !h-8 !text-[13px]"
                :class="{ '!border-nc-border-red': urlError }"
                placeholder="https://example.com/report.pdf"
                @press-enter="addUrl"
                @keydown.esc.stop="closePanel"
              />
              <NcButton type="primary" size="small" :disabled="!urlIsValid" @click="addUrl">Add</NcButton>
            </div>
            <div class="mt-2 text-xs" :class="urlError ? 'text-nc-content-red-medium' : 'text-nc-content-gray-muted'">
              {{ urlError || 'Public link to a file. Downloaded when the email is sent.' }}
            </div>
          </div>
        </template>
      </NcDropdown>
    </div>

    <input ref="fileInput" type="file" multiple style="display: none" @change="onFilesSelected" />
  </div>
</template>
