<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  attachments?: any[]
  selectedField: ColumnType
  attachmentFields: ColumnType[]
}>()

const emit = defineEmits(['open:file-picker'])

const activeAttachmentIndex = defineModel<number>('activeAttachmentIndex', {
  required: true,
})
const selectedFieldId = defineModel<string>('selectedFieldId', {
  required: true,
})

const { attachmentFields } = toRefs(props)

const isPublic = inject(IsPublicInj, ref(false))

/* stores */

const { isUIAllowed } = useRoles()

/* flags */

const readOnly = computed(() => !isUIAllowed('dataEdit') || isPublic.value)

/* expansion */

const isExpanded = ref(false)

const isFileContentMenuOpen = ref(false)

/* auto scroll */

const previewBarCellsContainer = ref<HTMLDivElement | null>(null)

const onMouseLeave = () => {
  if (isFileContentMenuOpen.value) return
  isExpanded.value = false
}

watch(activeAttachmentIndex, async () => {
  await nextTick()
  previewBarCellsContainer.value?.querySelector('& > div.preview-cell-wrapper-active')?.scrollIntoView({ behavior: 'smooth' })
})

watch(selectedFieldId, () => {
  isFileContentMenuOpen.value = false
})
</script>

<template>
  <div
    class="nc-attachments-preview-bar absolute left-0 top-0 bottom-0 bg-white border-r-1 border-gray-200 flex flex-col transition-all duration-300 z-10"
    :class="{
      'w-[80px]': !isExpanded,
      'w-[320px]': isExpanded,
    }"
    @mouseenter="isExpanded = true"
    @mouseleave="onMouseLeave"
  >
    <div class="px-4 py-3 overflow-hidden">
      <NcDropdownSelect
        v-model="selectedFieldId"
        class="nc-files-current-field-dropdown"
        :items="attachmentFields.map(field => ({ label: field.title || field.id!, value: field.id! }))"
        overlay-class-name="w-[288px]"
        @visible-change="isFileContentMenuOpen = $event"
      >
        <NcButton
          type="secondary"
          size="small"
          class="w-full overflow-hidden"
          inner-class="w-auto max-w-full !children:(justify-center w-full)"
        >
          <GeneralIcon icon="cellAttachment" class="w-4 h-4 aspect-square flex items-center justify-center" />
          <template v-if="isExpanded">
            <NcTooltip class="max-w-[calc(100%_-_100px)] truncate !leading-5" show-on-truncate-only>
              <template #title>{{ selectedField?.title }}</template>
              <span class="pl-2 nc-files-current-field-title">
                {{ selectedField?.title }}
              </span>
            </NcTooltip>
            <GeneralIcon icon="chevronDown" class="h-4 w-4 ml-1 text-gray-500 aspect-square flex items-center justify-center" />
          </template>
        </NcButton>
      </NcDropdownSelect>
    </div>
    <div class="flex-1 h-0 flex flex-col items-center justify-center">
      <div ref="previewBarCellsContainer" class="w-full max-h-full overflow-y-auto scrollbar-thin-dull px-2 pt-1 pb-6">
        <div
          v-for="(attachment, index) of props.attachments"
          :key="attachment.id"
          class="py-1"
          :class="{
            'preview-cell-wrapper-active': activeAttachmentIndex === index,
          }"
        >
          <SmartsheetExpandedFormPresentorsAttachmentsPreviewCell
            v-model:is-file-content-menu-open="isFileContentMenuOpen"
            :attachment="attachment"
            :selected-field="selectedField"
            :active="activeAttachmentIndex === index"
            :attachment-index="index"
            class="nc-files-preview-cell"
            :is-expanded="isExpanded"
            @click="activeAttachmentIndex = index"
            @expand="isExpanded = $event"
          />
        </div>
      </div>
    </div>
    <div v-if="!readOnly">
      <NcButton
        type="text"
        class="w-full !rounded-none !border-t-1 !rounded-t-lg !border-gray-200 !h-16"
        :disabled="readOnly"
        @click="emit('open:file-picker')"
      >
        <div class="flex flex-col items-center">
          <MaterialSymbolsAttachFile class="text-gray-500 text-sm" />
          <span class="mt-2"> Add file(s) </span>
        </div>
      </NcButton>
    </div>
  </div>
</template>
