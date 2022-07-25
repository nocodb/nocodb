<script setup lang="ts">
import type { ColumnType, ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { computed, inject, onMounted, provide, watch, watchEffect } from '#imports'
import { ActiveViewInj, FieldsInj, IsLockedInj, MetaInj, ReloadViewDataHookInj, TabMetaInj } from '~/context'
import useMetas from '~/composables/useMetas'

const { getMeta, metas } = useMetas()

const activeView = ref<ViewType>()
const el = ref<any>()
const fields = ref<ColumnType[]>([])

const tabMeta = inject(TabMetaInj)

const meta = computed(() => metas.value?.[tabMeta?.value?.id as string])

watchEffect(async () => {
  await getMeta(tabMeta?.value?.id as string)
})

const reloadEventHook = createEventHook<void>()

provide(MetaInj, meta)
provide(TabMetaInj, tabMeta)
provide(ActiveViewInj, activeView)
provide(IsLockedInj, false)
provide(ReloadViewDataHookInj, reloadEventHook)
provide(FieldsInj, fields)

watch(
  () => tabMeta && tabMeta?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal) await getMeta(newVal)
  },
)
</script>

<template>
  <div class="overflow-auto">
    <SmartsheetToolbar />
    <template v-if="meta">
      <div class="d-flex">
        <div v-if="activeView" class="flex-grow-1 min-w-0">
          <SmartsheetGrid v-if="activeView.type === ViewTypes.GRID" :ref="el" />
          <SmartsheetGallery v-else-if="activeView.type === ViewTypes.GALLERY" />
          <SmartsheetForm v-else-if="activeView.type === ViewTypes.FORM" />
        </div>
        <SmartsheetSidebar />
      </div>
    </template>
  </div>
</template>
