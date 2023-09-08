<script lang="ts" setup>
import { message } from 'ant-design-vue'
import type { ViewType } from 'nocodb-sdk'
import {
  ReloadRowDataHookInj,
  iconMap,
  isMac,
  useCopy,
  useExpandedFormStoreOrThrow,
  useSmartsheetRowStoreOrThrow,
  useSmartsheetStoreOrThrow,
  useUIPermission,
} from '#imports'

const props = defineProps<{ view?: ViewType }>()

const emit = defineEmits(['cancel', 'duplicateRow'])

const route = useRoute()

const { meta, isSqlView } = useSmartsheetStoreOrThrow()

const { commentsDrawer, displayValue, primaryKey, save: _save, loadRow } = useExpandedFormStoreOrThrow()

const { isNew, syncLTARRefs, state } = useSmartsheetRowStoreOrThrow()

const { isUIAllowed } = useUIPermission()

const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

const save = async () => {
  if (isNew.value) {
    const data = await _save(state.value)
    await syncLTARRefs(data)
    reloadTrigger?.trigger()
  } else {
    await _save()
    reloadTrigger?.trigger()
  }
}

// todo: accept as a prop / inject
const iconColor = '#1890ff'

const { dashboardUrl } = useDashboard()

const { copy } = useCopy()

const copyRecordUrl = () => {
  copy(
    encodeURI(
      `${dashboardUrl?.value}#/${route.params.typeOrId}/${route.params.projectId}/${meta.value?.id}${
        props.view ? `/${props.view.title}` : ''
      }?rowId=${primaryKey.value}`,
    ),
  )
  message.success('Copied to clipboard')
}

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (cmdOrCtrl) {
    switch (e.key) {
      case 'Enter': {
        if (isUIAllowed('tableRowUpdate')) {
          await save()
        }
      }
    }
  }
})

const showDeleteRowModal = ref(false)

const { deleteRowById } = useViewData(meta, ref(props.view))

const onDeleteRowClick = () => {
  showDeleteRowModal.value = true
}

const onConfirmDeleteRowClick = async () => {
  showDeleteRowModal.value = false
  await deleteRowById(primaryKey.value)
  reloadTrigger.trigger()
  emit('cancel')
  message.success('Row deleted')
}
</script>

<template>
  <div class="flex p-2 items-center gap-2 p-4 nc-expanded-form-header">
    <h5 class="text-lg font-weight-medium flex items-center gap-1 mb-0 min-w-0 overflow-x-hidden truncate">
      <GeneralTableIcon :style="{ color: iconColor }" :meta="meta" class="mx-2" />

      <template v-if="meta">
        {{ meta.title }}
      </template>

      <template v-if="displayValue">: {{ displayValue }}</template>
    </h5>

    <div class="flex-1" />
    <a-tooltip placement="bottom">
      <template #title>
        <!-- todo: i18n -->
        <div class="text-center w-full">Copy record URL</div>
      </template>
      <component
        :is="iconMap.link"
        v-if="!isNew"
        class="nc-icon-transition cursor-pointer select-none text-gray-500 mx-1 nc-copy-row-url min-w-4"
        @click="copyRecordUrl"
      />
    </a-tooltip>

    <a-tooltip v-if="!isSqlView" placement="bottom">
      <!--      Toggle comments draw -->
      <template #title>
        <div class="text-center w-full">{{ $t('activity.toggleCommentsDraw') }}</div>
      </template>
      <component
        :is="iconMap.comment"
        v-if="isUIAllowed('commentList') && !isNew"
        v-e="['c:row-expand:comment-toggle']"
        class="nc-icon-transition cursor-pointer select-none nc-toggle-comments text-gray-500 mx-1 min-w-4"
        @click="commentsDrawer = !commentsDrawer"
      />
    </a-tooltip>

    <NcButton
      class="nc-expand-form-save-btn !w-[60px]"
      type="primary"
      size="small"
      :disabled="!isUIAllowed('tableRowUpdate')"
      @click="save"
    >
      {{ $t('general.save') }}
    </NcButton>

    <a-dropdown>
      <component :is="iconMap.threeDotVertical" class="nc-icon-transition nc-expand-form-more-actions hover:cursor-pointer" />
      <template #overlay>
        <a-menu>
          <a-menu-item v-if="!isNew" @click="loadRow()">
            <div v-e="['c:row-expand:reload']" class="py-2 flex gap-2 items-center">
              <component
                :is="iconMap.reload"
                class="nc-icon-transition cursor-pointer select-none text-gray-500 mx-1 min-w-4 text-primary"
              />
              {{ $t('general.reload') }}
            </div>
          </a-menu-item>
          <a-menu-item v-if="isUIAllowed('xcDatatableEditable') && !isNew" @click="!isNew && emit('duplicateRow')">
            <div v-e="['c:row-expand:duplicate']" class="py-2 flex gap-2 a">
              <component
                :is="iconMap.copy"
                class="nc-icon-transition cursor-pointer select-none nc-duplicate-row text-gray-500 mx-1 min-w-4 text-primary"
              />
              {{ $t('activity.duplicateRow') }}
            </div>
          </a-menu-item>
          <a-menu-item v-if="isUIAllowed('xcDatatableEditable') && !isNew" @click="!isNew && onDeleteRowClick()">
            <div v-e="['c:row-expand:delete']" class="py-2 flex gap-2 items-center">
              <component
                :is="iconMap.delete"
                class="nc-icon-transition cursor-pointer select-none nc-delete-row text-gray-500 mx-1 min-w-4 text-primary"
              />
              {{ $t('activity.deleteRow') }}
            </div>
          </a-menu-item>
          <a-menu-item @click="emit('cancel')">
            <div v-e="['c:row-expand:delete']" class="py-2 flex gap-2 items-center">
              <component
                :is="iconMap.close"
                class="nc-icon-transition cursor-pointer select-none nc-delete-row text-gray-500 mx-1 min-w-4 text-primary"
              />
              {{ $t('general.close') }}
            </div>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
    <GeneralModal v-model:visible="showDeleteRowModal" class="!w-[25rem]">
      <div class="p-4">
        <div class="prose-xl font-bold self-center">Delete row ?</div>

        <div class="mt-4">Are you sure you want to delete this row?</div>
      </div>
      <div class="flex flex-row gap-x-2 mt-1 pt-1.5 justify-end p-4">
        <NcButton type="secondary" @click="showDeleteRowModal = false">{{ $t('general.cancel') }}</NcButton>
        <NcButton @click="onConfirmDeleteRowClick">{{ $t('general.confirm') }} </NcButton>
      </div>
    </GeneralModal>
  </div>
</template>

<style scoped>
:deep(svg) {
  @apply outline-none;
}
</style>
