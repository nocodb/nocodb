<script lang="ts" setup>
// import { ActiveViewInj, FieldsInj, IsPublicInj, MetaInj, inject, ref, useI18n, useNuxtApp, useProject } from '#imports'

import type { TableType, ViewType } from "nocodb-sdk"


// const { t } = useI18n()

// const sharedViewListDlg = ref(false)

// const isPublicView = inject(IsPublicInj, ref(false))

// const isView = false

// const { project } = useProject()

// const { $api } = useNuxtApp()

// const meta = inject(MetaInj, ref())

// const fields = inject(FieldsInj, ref([]))

// const selectedView = inject(ActiveViewInj, ref())


const { meta, view, primaryKey } = defineProps<{
  meta: TableType
  view: ViewType
  primaryKey: string
}>()

const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

const { deleteRowById } = useViewData(ref(meta), ref(view))

const duplicateRow = () => alert('duplicateRow')

const onDeleteRowClick = async () => {
  // alert('deleteRow')
  await deleteRowById(primaryKey)
  reloadTrigger.trigger()
  // loadData()
  // deleteRow
}
</script>

<template>
  <div>
    <a-dropdown>
      <a-button v-e="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn">
        <div class="flex gap-1 items-center">
          <MdiFlashOutline />

          <!-- More -->
          <span class="!text-sm font-weight-medium">{{ $t('general.more') }}</span>

          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>

      <template #overlay>
        <div class="bg-gray-50 py-2 shadow-lg !border">
          <div>
            <div v-e="['a:actions:download-csv']" class="nc-menu-item" @click="duplicateRow">
              <MdiContentCopy class="text-gray-500" />
              {{ $t('activity.duplicateRow') }}
            </div>

            <div v-e="['a:actions:download-excel']" class="nc-menu-item" @click="onDeleteRowClick">
              <MdiDelete class="text-gray-500" />
              {{ $t('activity.deleteRow') }}
            </div>
          </div>
        </div>
      </template>
    </a-dropdown>

    <!-- <a-modal
      v-model:visible="sharedViewListDlg"
      :class="{ active: sharedViewListDlg }"
      :title="$t('activity.listSharedView')"
      width="max(900px,60vw)"
      :footer="null"
      wrap-class-name="nc-modal-shared-view-list"
    >
      <LazySmartsheetToolbarSharedViewList v-if="sharedViewListDlg" />
    </a-modal> -->
  </div>
</template>
