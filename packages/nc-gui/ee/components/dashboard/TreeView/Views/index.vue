<script lang="ts" setup>
import type { ViewSectionType, ViewType } from 'nocodb-sdk'
import type { SortableEvent } from 'sortablejs'
import Sortable from 'sortablejs'

const base = inject(ProjectInj)!
const table = inject(SidebarTableInj)!

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const { $e } = useNuxtApp()

const { viewsByTable, activeView } = storeToRefs(useViewsStore())

const { loadViews } = useViewsStore()

const viewSectionsStore = useViewSectionsStore()

const { DEFAULT_SECTION_ID } = viewSectionsStore

const { pendingExpandSectionId } = storeToRefs(viewSectionsStore)

const sections = computed(() => {
  if (!table.value.base_id || !table.value.id) return []
  return viewSectionsStore.getSections(table.value.base_id, table.value.id)
})

const views = computed(() => {
  if (!table.value.base_id || !table.value.id) return []
  const key = `${table.value.base_id}:${table.value.id}`
  return viewsByTable.value.get(key) ?? []
})

const source = computed(() => base.value?.sources?.find((b) => b.id === table.value.source_id))

const isDefaultSource = computed(() => {
  if (base.value?.sources?.length === 1) return true
  if (!source.value) return false
  return isDefaultBase(source.value)
})

/** Expanded sections state stored in localStorage */
const expandedSections = ref<Record<string, boolean>>({})

/** Load expanded sections from localStorage */
const loadExpandedSections = () => {
  if (!table.value.base_id || !table.value.id) return
  const key = `view-sections-expanded-${table.value.base_id}:${table.value.id}`
  const stored = localStorage.getItem(key)
  if (stored) {
    expandedSections.value = JSON.parse(stored)
  }
}

/** Save expanded sections to localStorage (debounced) */
const saveExpandedSections = useDebounceFn(() => {
  if (!table.value.base_id || !table.value.id) return
  const key = `view-sections-expanded-${table.value.base_id}:${table.value.id}`
  localStorage.setItem(key, JSON.stringify(expandedSections.value))
}, 300)

/** Toggle section expanded state */
const toggleSectionExpanded = (sectionId?: string) => {
  if (!sectionId) return
  expandedSections.value[sectionId] = !expandedSections.value[sectionId]
  saveExpandedSections()
}

/** Whether the default folder should be shown (only when at least one real section exists) */
const showDefaultFolder = computed(() => sections.value.length > 0)

/** Get all section IDs including the virtual default section */
const allSectionIds = computed(() => {
  const ids = sections.value.map((s) => s.id).filter(Boolean) as string[]
  if (showDefaultFolder.value) {
    ids.push(DEFAULT_SECTION_ID)
  }
  return ids
})

/** Expand all sections */
const expandAllSections = () => {
  for (const id of allSectionIds.value) {
    expandedSections.value[id] = true
  }
  saveExpandedSections()
}

/** Collapse all sections */
const collapseAllSections = () => {
  for (const id of allSectionIds.value) {
    expandedSections.value[id] = false
  }
  saveExpandedSections()
}

/** Whether all sections are currently expanded */
const allSectionsExpanded = computed(() => {
  if (!allSectionIds.value.length) return false
  return allSectionIds.value.every((id) => expandedSections.value[id])
})

/** Whether all sections are currently collapsed */
const allSectionsCollapsed = computed(() => {
  if (!allSectionIds.value.length) return false
  return allSectionIds.value.every((id) => !expandedSections.value[id])
})

/** Get top-level views (not in any section) */
const getTopLevelViews = () => {
  return views.value.filter((v) => !v.fk_view_section_id)
}

/** Get views for a specific section */
const getViewsInSection = (sectionId?: string): ViewType[] => {
  if (sectionId === DEFAULT_SECTION_ID) {
    return getTopLevelViews()
  }
  return views.value.filter((v) => v.fk_view_section_id === sectionId)
}

/** Returns only the active view for a section (used when section is collapsed) */
const getActiveViewForSection = (sectionId?: string): ViewType[] => {
  const sectionViews = getViewsInSection(sectionId)
  const active = sectionViews.find((v) => v.id === activeView.value?.id)
  return active ? [active] : []
}

/** Virtual default section data */
const defaultSection = computed<ViewSectionType>(
  () =>
    ({
      id: DEFAULT_SECTION_ID,
      title: 'Default',
      order: Number.MAX_SAFE_INTEGER,
      fk_model_id: table.value.id,
    } as ViewSectionType),
)

/** Real sections sorted by order */
const sortedSections = computed(() => {
  return [...sections.value].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
})

/** Whether a section is currently being dragged */
const sectionsDragging = ref(false)

/** Whether a view is currently being dragged (for cross-section drop targets) */
const viewDragging = ref(false)

const onViewDragStart = () => {
  viewDragging.value = true
}

const onViewDragEnd = () => {
  viewDragging.value = false
}

/** Auto-expand the target section after a cross-section drop */
const onViewDroppedInSection = (sectionId: string) => {
  if (!expandedSections.value[sectionId]) {
    expandedSections.value[sectionId] = true
    saveExpandedSections()
  }
}

// Sections sortable — separate container that only holds real sections
let sectionsSortable: Sortable

const sectionsRef = useTemplateRef('sectionsRef')

const initSectionsSortable = (el: Element) => {
  if (isMobileMode.value) return
  if (sectionsSortable) sectionsSortable.destroy()

  sectionsSortable = Sortable.create(el as HTMLElement, {
    ghostClass: 'ghost',
    onStart: (evt: SortableEvent) => {
      evt.stopImmediatePropagation()
      evt.preventDefault()
      sectionsDragging.value = true
    },
    onEnd: async (evt) => {
      const { newIndex = 0, oldIndex = 0 } = evt

      evt.stopImmediatePropagation()
      evt.preventDefault()

      sectionsDragging.value = false

      if (newIndex === oldIndex) return

      const itemEl = evt.item as HTMLElement
      const itemId = itemEl.dataset.id
      if (!itemId) return

      const currentSection = sections.value.find((s) => s.id === itemId)
      if (!currentSection || !currentSection.id) return

      const children: HTMLCollection = evt.to.children

      if (children.length < 2) return

      const itemBeforeEl = children[newIndex - 1] as HTMLElement
      const itemAfterEl = children[newIndex + 1] as HTMLElement

      const itemBefore = itemBeforeEl && sections.value.find((s) => s.id === itemBeforeEl.dataset.id)
      const itemAfter = itemAfterEl && sections.value.find((s) => s.id === itemAfterEl.dataset.id)

      if (children.length - 1 === newIndex) {
        currentSection.order = (itemBefore?.order ?? 0) + 1
      } else if (newIndex === 0) {
        currentSection.order = (itemAfter?.order ?? 1) / 2
      } else {
        currentSection.order = ((itemBefore?.order ?? 0) + (itemAfter?.order ?? 0)) / 2
      }

      await viewSectionsStore.reorderSection(currentSection.id, currentSection.order)
      $e('a:view-section:reorder')
    },
    animation: 150,
    revertOnSpill: true,
    filter: isTouchEvent,
    ...getDraggableAutoScrollOptions({ scrollSensitivity: 50 }),
  })
}

watchEffect(() => {
  if (sectionsRef.value && isUIAllowed('viewCreateOrEdit') && showDefaultFolder.value) {
    initSectionsSortable(sectionsRef.value)
  }
})

/** Rename a section */
async function onRenameSection(section: ViewSectionType, newTitle: string) {
  if (!section.id) return
  try {
    await viewSectionsStore.updateSection(section.id, { title: newTitle })
    $e('a:view-section:rename')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Change section folder icon color */
async function onChangeSectionColor(section: ViewSectionType, color: string) {
  if (!section.id) return
  try {
    const currentMeta = parseProp(section.meta)
    await viewSectionsStore.updateSection(section.id, {
      meta: { ...currentMeta, iconColor: color },
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Section pending delete (for dialog) */
const sectionToDelete = ref<ViewSectionType | null>(null)

const showDeleteSectionModal = ref(false)

/** Open delete section dialog */
function openDeleteSectionDialog(section: ViewSectionType) {
  sectionToDelete.value = section
  showDeleteSectionModal.value = true
}

/** Confirm section deletion */
async function onDeleteSection() {
  if (!sectionToDelete.value?.id) return
  try {
    await viewSectionsStore.deleteSection(sectionToDelete.value.id)
    $e('a:view-section:delete')
    await loadViews({
      force: true,
      tableId: table.value.id!,
      baseId: base.value.id!,
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  showDeleteSectionModal.value = false
  sectionToDelete.value = null
}

/** Auto-expand section when a view is moved into it */
watch(pendingExpandSectionId, (sectionId) => {
  if (sectionId) {
    expandedSections.value[sectionId] = true
    saveExpandedSections()
    viewSectionsStore.clearPendingExpand()
  }
})

/** Load sections and init expanded state on table change */
watch(
  () => table.value.id,
  async (newTableId) => {
    if (newTableId) {
      await viewSectionsStore.loadSections({
        tableId: newTableId,
        baseId: table.value.base_id!,
      })
      loadExpandedSections()
      if (expandedSections.value[DEFAULT_SECTION_ID] === undefined) {
        expandedSections.value[DEFAULT_SECTION_ID] = true
        saveExpandedSections()
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <!-- Sections exist: section sortable + per-section view lists -->
    <template v-if="showDefaultFolder">
      <!-- Real sections sortable container (only real sections, not default) -->
      <div ref="sectionsRef" class="nc-views-sections flex flex-col w-full">
        <div v-for="section of sortedSections" :key="section.id" :data-id="section.id" class="w-full">
          <DashboardTreeViewViewsSectionNode
            :section="section"
            :is-expanded="!!expandedSections[section.id!]"
            :all-expanded="allSectionsExpanded"
            :all-collapsed="allSectionsCollapsed"
            :is-default="false"
            :is-default-source="isDefaultSource"
            :is-dragging="sectionsDragging"
            @expand-toggle="toggleSectionExpanded(section.id)"
            @rename="onRenameSection(section, $event)"
            @delete="openDeleteSectionDialog(section)"
            @open-menu="null"
            @expand-all="expandAllSections"
            @collapse-all="collapseAllSections"
            @change-color="onChangeSectionColor(section, $event)"
          />
          <DashboardTreeViewViewsList
            v-if="expandedSections[section.id!] || getActiveViewForSection(section.id).length || viewDragging"
            :section-views="expandedSections[section.id!] ? getViewsInSection(section.id) : getActiveViewForSection(section.id)"
            :is-in-section="true"
            :section-id="section.id"
            @view-drag-start="onViewDragStart"
            @view-drag-end="onViewDragEnd"
            @view-dropped-in-section="onViewDroppedInSection"
          />
        </div>
      </div>

      <!-- Default section — always last, not sortable -->
      <div>
        <DashboardTreeViewViewsSectionNode
          :section="defaultSection"
          :is-expanded="!!expandedSections[DEFAULT_SECTION_ID]"
          :all-expanded="allSectionsExpanded"
          :all-collapsed="allSectionsCollapsed"
          :is-default="true"
          :is-default-source="isDefaultSource"
          :is-dragging="sectionsDragging"
          @expand-toggle="toggleSectionExpanded(DEFAULT_SECTION_ID)"
          @expand-all="expandAllSections"
          @collapse-all="collapseAllSections"
        />
        <DashboardTreeViewViewsList
          v-if="expandedSections[DEFAULT_SECTION_ID] || getActiveViewForSection(DEFAULT_SECTION_ID).length || viewDragging"
          :section-views="
            expandedSections[DEFAULT_SECTION_ID]
              ? getViewsInSection(DEFAULT_SECTION_ID)
              : getActiveViewForSection(DEFAULT_SECTION_ID)
          "
          :hide-create-view-btn="true"
          :is-in-section="true"
          :section-id="DEFAULT_SECTION_ID"
          @view-drag-start="onViewDragStart"
          @view-drag-end="onViewDragEnd"
          @view-dropped-in-section="onViewDroppedInSection"
        />
      </div>
    </template>

    <!-- No sections: flat view list (Create View button already rendered above) -->
    <template v-else>
      <DashboardTreeViewViewsList />
    </template>

    <!-- Delete section confirmation modal -->
    <GeneralDeleteModal
      v-model:visible="showDeleteSectionModal"
      :entity-name="$t('objects.section')"
      :on-delete="onDeleteSection"
    >
      <template #entity-preview>
        <div
          v-if="sectionToDelete"
          class="flex flex-row items-center py-2 px-3 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle"
        >
          <GeneralIcon
            icon="ncFolderOpen"
            class="w-4 min-h-4"
            :style="{ color: parseProp(sectionToDelete?.meta)?.iconColor || '#3f8292' }"
          />
          <div
            class="capitalize text-ellipsis overflow-hidden select-none w-full pl-3"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
          >
            <span>{{ sectionToDelete.title }}</span>
          </div>
        </div>
        <div class="mt-2 text-nc-content-gray-subtle text-sm">
          {{ $t('msg.info.sectionDeleteConfirmation') }}
        </div>
      </template>
    </GeneralDeleteModal>
  </div>
</template>

<style lang="scss">
.nc-views-sections {
  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  .ghost {
    @apply !bg-nc-bg-gray-medium;
  }
}
</style>
