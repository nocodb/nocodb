<script setup lang="ts">
import type { DocumentType } from 'nocodb-sdk'

interface Props {
  doc: DocumentType
  activeId?: string | null
  getChildren: (docId: string) => DocumentType[]
  loadChildren: (docId: string) => Promise<void> | void
  onSelect: (doc: DocumentType) => void
}

const props = defineProps<Props>()

const emits = defineEmits<{
  'open-change': [boolean]
}>()

const { t } = useI18n()

const label = computed(() => props.doc.title || t('general.untitled'))

const children = computed(() => (props.doc.id ? props.getChildren(props.doc.id) : []))

const hasChildren = computed(() => !!props.doc.has_children)

const isActive = computed(() => props.doc.id === props.activeId)

const isOpen = ref(false)

// Count of descendant dropdowns that are currently open. Parent must stay
// open while any descendant is visible, otherwise moving the mouse from
// level N+1 back through level N to level N+2 closes level N prematurely.
const openDescendantCount = ref(0)

const onDescendantOpenChange = (val: boolean) => {
  openDescendantCount.value += val ? 1 : -1
  if (openDescendantCount.value < 0) openDescendantCount.value = 0
}

const onVisibleChange = (val: boolean) => {
  // Ignore close requests while a descendant is still open
  if (!val && openDescendantCount.value > 0) return
  isOpen.value = val
}

watch(isOpen, (open) => {
  emits('open-change', open)
  if (open && props.doc.has_children && props.doc.id) {
    props.loadChildren(props.doc.id)
  }
})

const onClickRow = (e: MouseEvent) => {
  e.stopPropagation()
  props.onSelect(props.doc)
}
</script>

<template>
  <NcDropdown
    v-if="hasChildren"
    :visible="isOpen"
    :trigger="['hover']"
    placement="rightTop"
    overlay-class-name="nc-doc-breadcrumb-submenu-overlay"
    @update:visible="onVisibleChange"
  >
    <div
      class="nc-doc-breadcrumb-row"
      :class="{ 'nc-doc-breadcrumb-row-active': isActive }"
      @click="onClickRow"
    >
      <LazyGeneralEmojiPicker v-if="doc.meta?.icon" :emoji="doc.meta.icon" readonly size="xsmall" class="flex-none" />
      <GeneralIcon v-else icon="ncFileText" class="flex-none !w-4 !h-4 text-nc-content-gray-muted" />
      <NcTooltip class="truncate flex-1 min-w-0" show-on-truncate-only>
        <template #title>{{ label }}</template>
        {{ label }}
      </NcTooltip>
      <GeneralIcon icon="arrowRight" class="flex-none text-base text-nc-content-gray-subtle2" />
    </div>

    <template #overlay>
      <div class="nc-doc-breadcrumb-submenu">
        <DocBreadcrumbMenuRow
          v-for="child in children"
          :key="child.id"
          :doc="child"
          :active-id="activeId"
          :get-children="getChildren"
          :load-children="loadChildren"
          :on-select="onSelect"
          @open-change="onDescendantOpenChange"
        />
      </div>
    </template>
  </NcDropdown>

  <div
    v-else
    class="nc-doc-breadcrumb-row"
    :class="{ 'nc-doc-breadcrumb-row-active': isActive }"
    @click="onSelect(doc)"
  >
    <LazyGeneralEmojiPicker v-if="doc.meta?.icon" :emoji="doc.meta.icon" readonly size="xsmall" class="flex-none" />
    <GeneralIcon v-else icon="ncFileText" class="flex-none !w-4 !h-4 text-nc-content-gray-muted" />
    <NcTooltip class="truncate flex-1 min-w-0" show-on-truncate-only>
      <template #title>{{ label }}</template>
      {{ label }}
    </NcTooltip>
    <GeneralIcon v-if="isActive" icon="check" class="flex-none text-primary w-4 h-4" />
  </div>
</template>
