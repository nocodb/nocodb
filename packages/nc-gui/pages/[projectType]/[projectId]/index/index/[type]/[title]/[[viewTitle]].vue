<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { TabItem } from '~/lib'
import {
  ActiveViewInj,
  FieldsInj,
  IsFormInj,
  IsLockedInj,
  MetaInj,
  OpenNewRecordFormHookInj,
  ReloadViewDataHookInj,
  ReloadViewMetaHookInj,
  TabMetaInj,
  computed,
  createEventHook,
  inject,
  provide,
  ref,
  until,
  useMetas,
  useProject,
  useProvideSmartsheetStore,
  useRoute,
  useSidebar,
  watch,
} from '#imports'

const { getMeta } = useMetas()

const { tables } = useProject()

const route = useRoute()

const loading = ref(true)

const activeTab = inject(
  TabMetaInj,
  computed(() => ({} as TabItem)),
)

/** wait until table list loads since meta load requires table list **/
until(tables)
  .toMatch((tables) => tables.length > 0)
  .then(() => {
    getMeta(route.params.title as string, true).finally(() => (loading.value = false))
  })

const { metas } = useMetas()

const activeView = ref()

const fields = ref<ColumnType[]>([])

const meta = computed<TableType | undefined>(() => metas.value[activeTab.value.id!])

const reloadEventHook = createEventHook()

const reloadViewMetaEventHook = createEventHook()

const openNewRecordFormHook = createEventHook()

const { isGallery, isGrid, isForm, isLocked } = useProvideSmartsheetStore(activeView, meta)

// provide the sidebar injection state
useSidebar('nc-right-sidebar', { useStorage: true, isOpen: true })

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

const treeViewIsLockedInj = inject('TreeViewIsLockedInj', ref(false))

watch(isLocked, (nextValue) => (treeViewIsLockedInj.value = nextValue), { immediate: true })
console.log('smartsheet')
</script>

<template>
  <div class="w-full h-full">
    <div v-if="loading" class="flex items-center justify-center h-full w-full">
      <a-spin size="large" />
    </div>

    <div v-else class="nc-container flex h-full">
      <div class="flex flex-col h-full flex-1 min-w-0">
        <LazySmartsheetToolbar />

        <Transition name="layout" mode="out-in">
          <template v-if="meta">
            <div class="flex flex-1 min-h-0">
              <div v-if="activeView" class="h-full flex-1 min-w-0 min-h-0 bg-gray-50">
                <LazySmartsheetGrid v-if="isGrid" />

                <LazySmartsheetGallery v-else-if="isGallery" />

                <LazySmartsheetForm v-else-if="isForm && !$route.query.reload" />
              </div>
            </div>
          </template>
        </Transition>
      </div>

      <LazySmartsheetSidebar v-if="meta" class="nc-right-sidebar" />
    </div>
  </div>
</template>
