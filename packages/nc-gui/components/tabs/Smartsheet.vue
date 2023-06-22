<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes, isLinksOrLTAR } from 'nocodb-sdk'
import {
  ActiveViewInj,
  FieldsInj,
  IsFormInj,
  IsLockedInj,
  MetaInj,
  OpenNewRecordFormHookInj,
  ReadonlyInj,
  ReloadViewDataHookInj,
  ReloadViewMetaHookInj,
  TabMetaInj,
  computed,
  createEventHook,
  provide,
  ref,
  toRef,
  useMetas,
  useProvideKanbanViewStore,
  useProvideSmartsheetStore,
  useUIPermission,
} from '#imports'
import type { TabItem } from '~/lib'

const props = defineProps<{
  activeTab: TabItem
}>()

const { isUIAllowed } = useUIPermission()

const { metas, getMeta } = useMetas()

const activeTab = toRef(props, 'activeTab')

const activeView = ref()

const fields = ref<ColumnType[]>([])

const meta = computed<TableType | undefined>(() => activeTab.value && metas.value[activeTab.value.id!])

const { isGallery, isGrid, isForm, isKanban, isLocked, isMap } = useProvideSmartsheetStore(activeView, meta)

const reloadEventHook = createEventHook<void | boolean>()

const reloadViewMetaEventHook = createEventHook<void | boolean>()

const openNewRecordFormHook = createEventHook<void>()

useProvideKanbanViewStore(meta, activeView)
useProvideMapViewStore(meta, activeView)

// todo: move to store
provide(MetaInj, meta)
provide(ActiveViewInj, activeView)
provide(IsLockedInj, isLocked)
provide(ReloadViewDataHookInj, reloadEventHook)
provide(ReloadViewMetaHookInj, reloadViewMetaEventHook)
provide(OpenNewRecordFormHookInj, openNewRecordFormHook)
provide(FieldsInj, fields)
provide(IsFormInj, isForm)
provide(TabMetaInj, activeTab)
provide(
  ReadonlyInj,
  computed(() => !isUIAllowed('xcDatatableEditable')),
)

const grid = ref()

const onDrop = async (event: DragEvent) => {
  event.preventDefault()
  try {
    // Access the dropped data
    const data = JSON.parse(event.dataTransfer?.getData('text/json')!)
    // Do something with the received data

    // if dragged item is not from the same base, return
    if (data.baseId !== meta.value?.base_id) return

    // if dragged item or opened view is not a table, return
    if (data.type !== 'table' || meta.value?.type !== 'table') return

    const childMeta = await getMeta(data.id)
    const parentMeta = metas.value[meta.value.id!]

    if (!childMeta || !parentMeta) return

    const parentPkCol = parentMeta.columns?.find((c) => c.pk)
    const childPkCol = childMeta.columns?.find((c) => c.pk)

    // if already a link column exists, create a new Lookup column
    const relationCol = parentMeta.columns?.find((c: ColumnType) => {
      if (!isLinksOrLTAR(c)) return false

      const ltarOptions = c.colOptions as LinkToAnotherRecordType

      return ltarOptions.fk_related_model_id === childMeta.id
    })
    if (relationCol) {
      const lookupCol = childMeta.columns?.find((c) => c.pv) ?? childMeta.columns?.[0]
      grid.value?.openColumnCreate({
        uidt: UITypes.Lookup,
        title: `${relationCol.title}Lookup`,
        fk_relation_column_id: relationCol.id,
        fk_lookup_column_id: lookupCol?.id,
      })
    } else {
      grid.value?.openColumnCreate({
        uidt: UITypes.Links,
        title: `${data.title}`,
        parentId: parentMeta.id,
        childId: childMeta.id,
        parentTable: parentMeta.title,
        parentColumn: parentPkCol.title,
        childTable: childMeta.title,
        childColumn: childPkCol?.title,
      })
    }
  } catch (e) {
    console.log('error', e)
  }
}
</script>

<template>
  <div class="nc-container flex h-full" @drop="onDrop" @dragover.prevent>
    <div class="flex flex-col h-full flex-1 min-w-0">
      <LazySmartsheetToolbar />

      <Transition name="layout" mode="out-in">
        <template v-if="meta">
          <div class="flex flex-1 min-h-0">
            <div v-if="activeView" class="h-full flex-1 min-w-0 min-h-0 bg-gray-50">
              <LazySmartsheetGrid v-if="isGrid" ref="grid" />

              <LazySmartsheetGallery v-else-if="isGallery" />

              <LazySmartsheetForm v-else-if="isForm && !$route.query.reload" />

              <LazySmartsheetKanban v-else-if="isKanban" />

              <LazySmartsheetMap v-else-if="isMap" />
            </div>
          </div>
        </template>
      </Transition>
    </div>

    <LazySmartsheetExpandedFormDetached />

    <!-- Lazy loading the sidebar causes issues when deleting elements, i.e. it appears as if multiple elements are removed when they are not -->
    <SmartsheetSidebar v-if="meta" class="nc-right-sidebar" />
  </div>
</template>

<style scoped>
:deep(.nc-right-sidebar.ant-layout-sider-collapsed) {
  @apply !w-0 !max-w-0 !min-w-0 overflow-x-hidden;
}
</style>
