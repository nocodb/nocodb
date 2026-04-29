<script setup lang="ts">
import type { DocumentType } from 'nocodb-sdk'
import { DocBreadcrumbCloseTokenInj } from './docBreadcrumbInjections'

interface Props {
  doc: DocumentType
  /** Ids on the active path — every ancestor plus the currently-open doc */
  activeIds?: string[]
  getChildren: (docId: string) => DocumentType[]
  loadChildren: (docId: string) => Promise<void> | void
  onSelect: (doc: DocumentType) => void
}

const props = defineProps<Props>()

const emits = defineEmits<{
  'open-change': [boolean]
}>()

const { t } = useI18n()

// Incremented by the top-level segment when its dropdown closes — every open
// descendant submenu watches this and force-closes itself, otherwise Ant
// Design's body-mounted popups stay visible after the parent hides.
const closeToken = inject(DocBreadcrumbCloseTokenInj, ref(0))

const label = computed(() => props.doc.title || t('general.untitled'))

const children = computed(() => (props.doc.id ? props.getChildren(props.doc.id) : []))

const hasChildren = computed(() => !!props.doc.has_children)

const isActive = computed(() => !!props.doc.id && !!props.activeIds?.includes(props.doc.id))

const isOpen = ref(false)

// Parent must stay open while any descendant is visible, otherwise moving the
// mouse from level N+1 back through level N to level N+2 closes level N
// prematurely. Tracked as a Set keyed by child id so duplicate events are
// idempotent and the counter can't drift positive from missed decrements.
const openDescendantIds = ref(new Set<string>())

const onDescendantOpenChange = (childId: string | undefined, val: boolean) => {
  if (!childId) return
  const next = new Set(openDescendantIds.value)
  if (val) next.add(childId)
  else next.delete(childId)
  openDescendantIds.value = next
}

const onVisibleChange = (val: boolean) => {
  // Ignore close requests while a descendant is still open
  if (!val && openDescendantIds.value.size > 0) return
  isOpen.value = val
}

watch(isOpen, (open) => {
  emits('open-change', open)
  if (open && props.doc.has_children && props.doc.id) {
    props.loadChildren(props.doc.id)
  }
})

watch(closeToken, () => {
  if (isOpen.value) isOpen.value = false
})

// Guarantee the parent's tracker releases this row even if a close event
// didn't fire (rapid unmount, route change, async teardown).
onBeforeUnmount(() => {
  if (isOpen.value) emits('open-change', false)
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
    :align="{ offset: [2, -5] }"
    overlay-class-name="nc-doc-breadcrumb-submenu-overlay"
    @update:visible="onVisibleChange"
  >
    <div class="nc-doc-breadcrumb-row" :class="{ 'nc-doc-breadcrumb-row-active': isActive }" @click="onClickRow">
      <LazyGeneralEmojiPicker v-if="doc.meta?.icon" :emoji="doc.meta.icon" readonly size="xsmall" class="flex-none" />
      <GeneralIcon v-else icon="ncFileText" class="flex-none !w-4 !h-4 text-nc-content-gray-muted" />
      <NcTooltip class="truncate flex-1 min-w-0" show-on-truncate-only>
        <template #title>{{ label }}</template>
        {{ label }}
      </NcTooltip>
      <GeneralIcon icon="ncChevronRight" class="flex-none !opacity-60" />
    </div>

    <template #overlay>
      <div class="nc-doc-breadcrumb-submenu">
        <DocBreadcrumbMenuRow
          v-for="child in children"
          :key="child.id"
          :doc="child"
          :active-ids="activeIds"
          :get-children="getChildren"
          :load-children="loadChildren"
          :on-select="onSelect"
          @open-change="(val: boolean) => onDescendantOpenChange(child.id, val)"
        />
      </div>
    </template>
  </NcDropdown>

  <div v-else class="nc-doc-breadcrumb-row" :class="{ 'nc-doc-breadcrumb-row-active': isActive }" @click="onSelect(doc)">
    <LazyGeneralEmojiPicker v-if="doc.meta?.icon" :emoji="doc.meta.icon" readonly size="xsmall" class="flex-none" />
    <GeneralIcon v-else icon="ncFileText" class="flex-none !w-4 !h-4 text-nc-content-gray-muted" />
    <NcTooltip class="truncate flex-1 min-w-0" show-on-truncate-only>
      <template #title>{{ label }}</template>
      {{ label }}
    </NcTooltip>
  </div>
</template>
