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

const workflowContext = inject(WorkflowVariableInj, null)

const items = computed<FormBuilderAttachmentItem[]>(() => (Array.isArray(vModel.value) ? vModel.value : []))

const setItems = (next: FormBuilderAttachmentItem[]) => {
  vModel.value = next.length ? next : null
}

const maxItems = computed(() => props.element.maxItems ?? 10)

const canAdd = computed(() => !props.disabled && items.value.length < maxItems.value)

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

const allVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariablesFlat) return []
  return workflowContext.getAvailableVariablesFlat(selectedNodeId.value)
})

const allGroupedVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariables) return []
  return workflowContext.getAvailableVariables(selectedNodeId.value)
})

const addMenuOpen = ref(false)

const pickerOpen = ref(false)

const openPicker = () => {
  addMenuOpen.value = false
  pickerOpen.value = true
}

const addVariable = ({ label, expression }: { id: string; label: string; expression: string }) => {
  setItems([...items.value, { type: 'variable', expression, label }])
  pickerOpen.value = false
}

const addUrl = () => {
  addMenuOpen.value = false
  setItems([...items.value, { type: 'url', url: '' }])
}

const updateUrl = (index: number, url: string) => {
  const next = [...items.value]
  const current = next[index]
  if (!current || current.type !== 'url') return
  next[index] = { ...current, url }
  setItems(next)
}

const removeItem = (index: number) => {
  setItems(items.value.filter((_, i) => i !== index))
}

const fileInput = ref<HTMLInputElement>()

const isUploading = ref(false)

const triggerUpload = () => {
  addMenuOpen.value = false
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

const itemIcon = (item: FormBuilderAttachmentItem) => {
  if (item.type === 'variable') return item.icon || 'cellAttachment'
  if (item.type === 'file') return getAttachmentIcon(item.title, item.mimetype)
  return 'ncLink'
}
</script>

<template>
  <div class="nc-form-builder-attachments flex flex-col gap-2">
    <div v-for="(item, index) in items" :key="index" class="flex items-center gap-1 min-w-0">
      <div v-if="item.type === 'url'" class="flex-1 min-w-0">
        <NcFormBuilderInputWorkflowInput
          :model-value="item.url"
          placeholder="https://example.com/file.pdf"
          :variables="allVariables"
          :grouped-variables="allGroupedVariables"
          :read-only="disabled"
          @update:model-value="updateUrl(index, $event)"
        />
      </div>
      <div
        v-else
        class="nc-attachment-chip flex items-center gap-2 h-8 px-2 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default min-w-0"
      >
        <GeneralIcon :icon="itemIcon(item)" class="w-4 h-4 flex-none text-nc-content-gray-subtle" />
        <NcTooltip class="truncate text-small text-nc-content-gray-emphasis" show-on-truncate-only>
          <template #title>{{ item.type === 'variable' ? item.expression : item.title }}</template>
          {{ item.type === 'variable' ? item.label : item.title }}
        </NcTooltip>
        <span v-if="item.type === 'file'" class="text-xs text-nc-content-gray-muted flex-none">
          {{ getReadableFileSize(item.size) }}
        </span>
      </div>
      <NcButton v-if="!disabled" size="xs" type="text" class="flex-none" @click="removeItem(index)">
        <GeneralIcon icon="close" class="w-3.5 h-3.5" />
      </NcButton>
    </div>

    <div class="flex items-center gap-2">
      <NcDropdown v-model:visible="pickerOpen" :trigger="[]" placement="bottomRight">
        <NcDropdown v-model:visible="addMenuOpen" :trigger="['click']" :disabled="!canAdd" placement="bottomLeft">
          <NcButton size="small" type="text" :disabled="!canAdd" :loading="isUploading" class="!px-2">
            <div class="flex items-center gap-1">
              <GeneralIcon icon="plus" class="w-4 h-4" />
              <span>Add</span>
            </div>
          </NcButton>
          <template #overlay>
            <NcMenu>
              <NcMenuItem :disabled="!flatAttachmentVariables.length" @click="openPicker">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="cellAttachment" class="w-4 h-4" />
                  <span>From attachment field</span>
                </div>
              </NcMenuItem>
              <NcMenuItem v-if="allowUpload" @click="triggerUpload">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="ncUpload" class="w-4 h-4" />
                  <span>Upload file</span>
                </div>
              </NcMenuItem>
              <NcMenuItem v-if="allowUrl" @click="addUrl">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="ncLink" class="w-4 h-4" />
                  <span>From URL</span>
                </div>
              </NcMenuItem>
            </NcMenu>
          </template>
        </NcDropdown>
        <template #overlay>
          <div @click.stop>
            <WorkflowVariablePicker
              :items="flatAttachmentVariables"
              :grouped-items="groupedAttachmentVariables"
              :command="addVariable"
            />
          </div>
        </template>
      </NcDropdown>
      <span v-if="items.length >= maxItems" class="text-xs text-nc-content-gray-muted">Up to {{ maxItems }} files</span>
    </div>

    <input ref="fileInput" type="file" multiple class="hidden" @change="onFilesSelected" />
  </div>
</template>
