<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import { useGlobal } from '../../composables/useGlobal'
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

const { metas } = useMetas()

const activeTab = toRef(props, 'activeTab')

const activeView = ref()

const fields = ref<ColumnType[]>([])

const meta = computed<TableType | undefined>(() => activeTab.value && metas.value[activeTab.value.id!])

const { isGallery, isGrid, isForm, isKanban, isLocked } = useProvideSmartsheetStore(activeView, meta)

const reloadEventHook = createEventHook<void | boolean>()

const reloadViewMetaEventHook = createEventHook<void | boolean>()

const openNewRecordFormHook = createEventHook<void>()

useProvideKanbanViewStore(meta, activeView)

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

</script>

<template>
  <div class="nc-container flex h-full">
    <div class="flex flex-col h-full flex-1 min-w-0">
      <LazySmartsheetToolbar />

      <Transition name="layout" mode="out-in">
        <template v-if="meta">
          <div class="flex flex-1 min-h-0">
            <div v-if="activeView" class="h-full flex-1 min-w-0 min-h-0 bg-gray-50">
              <LazySmartsheetGrid v-if="isGrid" />

              <LazySmartsheetGallery v-else-if="isGallery" />

              <LazySmartsheetForm v-else-if="isForm && !$route.query.reload" />

              <LazySmartsheetKanban v-else-if="isKanban" />
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
