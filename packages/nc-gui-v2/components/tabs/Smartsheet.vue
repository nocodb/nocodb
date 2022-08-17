<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import SmartsheetGrid from '../smartsheet/Grid.vue'
import { computed, inject, provide, useMetas, useProvideSmartsheetStore, watch, watchEffect } from '#imports'
import { ActiveViewInj, FieldsInj, IsLockedInj, MetaInj, ReloadViewDataHookInj, RightSidebarInj, TabMetaInj } from '~/context'
import type { TabItem } from '~/composables'

const { getMeta, metas } = useMetas()

const activeView = ref()

const el = ref<typeof SmartsheetGrid>()

const fields = ref<ColumnType[]>([])

const tabMeta = inject(
  TabMetaInj,
  computed(() => ({} as TabItem)),
)

const meta = computed<TableType>(() => metas.value?.[tabMeta?.value?.id as string])

watchEffect(async () => {
  await getMeta(tabMeta?.value?.id as string)
})

const reloadEventHook = createEventHook<void>()

const { isGallery, isGrid, isForm, isLocked } = useProvideSmartsheetStore(activeView as Ref<TableType>, meta)

// todo: move to store
provide(MetaInj, meta)
provide(TabMetaInj, tabMeta)
provide(ActiveViewInj, activeView)
provide(IsLockedInj, isLocked)
provide(ReloadViewDataHookInj, reloadEventHook)
provide(FieldsInj, fields)
provide(RightSidebarInj, ref(false))

watch(tabMeta, async (newTabMeta, oldTabMeta) => {
  if (newTabMeta !== oldTabMeta && newTabMeta?.id) await getMeta(newTabMeta.id)
})
</script>

<template>
  <div class="nc-container flex h-full">
    <div class="flex flex-col h-full flex-1 min-w-0">
      <SmartsheetToolbar />

      <template v-if="meta">
        <div class="flex flex-1 min-h-0">
          <div v-if="activeView" class="h-full flex-grow min-w-0 min-h-0">
            <SmartsheetGrid v-if="isGrid" :ref="el" />

            <SmartsheetGallery v-else-if="isGallery" />

            <SmartsheetForm v-else-if="isForm" />
          </div>
        </div>

        <teleport to="#content">
          <SmartsheetSidebar />
        </teleport>
      </template>
    </div>
  </div>
</template>
