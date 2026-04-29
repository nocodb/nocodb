<script setup lang="ts">
import type { DocumentType } from 'nocodb-sdk'
import { DocBreadcrumbCloseTokenInj, DocBreadcrumbOpenChildInj } from './docBreadcrumbInjections'

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

// Explicit name for recursive `<DocBreadcrumbMenuRow>` use inside its own
// template — keeps Vue devtools and HMR stable across edits.
defineOptions({ name: 'DocBreadcrumbMenuRow' })

const { t } = useI18n()

const { isRtl } = useRtl()

// Inject ancestor signals: parentCloseToken bumps when an ancestor closes,
// parentOpenChildId tracks which sibling is currently active under our
// immediate parent. We also provide our own versions, shadowing for our
// descendant subtree.
const parentCloseToken = inject(DocBreadcrumbCloseTokenInj, ref(0))
const parentOpenChildId = inject(DocBreadcrumbOpenChildInj, ref<string | null>(null))

const closeToken = ref(0)
provide(DocBreadcrumbCloseTokenInj, closeToken)

const openChildId = ref<string | null>(null)
provide(DocBreadcrumbOpenChildInj, openChildId)

const label = computed(() => props.doc.title || t('general.untitled'))

const submenuPlacement = computed(() => (isRtl.value ? 'leftTop' : 'rightTop'))

const submenuAlign = computed(() => ({ offset: [isRtl.value ? -2 : 2, -5] as [number, number] }))

const chevronIcon = computed(() => (isRtl.value ? 'ncChevronLeft' : 'ncChevronRight'))

const children = computed(() => (props.doc.id ? props.getChildren(props.doc.id) : []))

const hasChildren = computed(() => !!props.doc.has_children)

const isActive = computed(() => !!props.doc.id && !!props.activeIds?.includes(props.doc.id))

const isOpen = ref(false)

// Siblings are mutually exclusive — at most one child of this row may have
// its submenu open. When that child closes, we clear the slot.
const onDescendantOpenChange = (childId: string | undefined, val: boolean) => {
  if (!childId) return
  if (val) openChildId.value = childId
  else if (openChildId.value === childId) openChildId.value = null
}

// Block hover-out close while a deeper submenu is still alive — moving the
// cursor through this row to reach a child popup must not collapse this row.
const onVisibleChange = (val: boolean) => {
  if (!val && openChildId.value) return
  isOpen.value = val
}

watch(isOpen, (open) => {
  emits('open-change', open)
  if (open && props.doc.has_children && props.doc.id) {
    props.loadChildren(props.doc.id)
  }
  // Cascade close to descendants when this row closes (Ant Design popups are
  // body-mounted so they don't tear down on parent overlay hide on their own).
  if (!open) {
    closeToken.value++
    openChildId.value = null
  }
})

// React to ancestor closing (e.g. segment dropdown collapses, or a higher
// ancestor row closes due to a sibling switch).
watch(parentCloseToken, () => {
  if (isOpen.value) isOpen.value = false
})

// React to a sibling switch — when our immediate parent's active child is no
// longer us, force-close immediately, bypassing the hover-out block above.
watch(parentOpenChildId, (newId) => {
  if (newId !== null && newId !== props.doc.id && isOpen.value) {
    isOpen.value = false
  }
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
    :placement="submenuPlacement"
    :align="submenuAlign"
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
      <GeneralIcon :icon="chevronIcon" class="flex-none !opacity-60" />
    </div>

    <template #overlay>
      <div class="nc-doc-breadcrumb-submenu">
        <div v-if="!children.length" class="flex items-center justify-center px-3 py-3">
          <GeneralLoader size="regular" />
        </div>
        <template v-else>
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
        </template>
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
