<script lang="ts" setup>
import { message } from 'ant-design-vue'
import {
  ReloadRowDataHookInj,
  useExpandedFormStoreOrThrow,
  useSmartsheetRowStoreOrThrow,
  useSmartsheetStoreOrThrow,
  useUIPermission,
} from '#imports'

const emit = defineEmits(['cancel'])

const { project } = useProject()

const { meta, isSqlView } = useSmartsheetStoreOrThrow()

const { commentsDrawer, primaryValue, primaryKey, save: _save, loadRow } = useExpandedFormStoreOrThrow()

const { isNew, syncLTARRefs } = useSmartsheetRowStoreOrThrow()

const { isUIAllowed } = useUIPermission()

const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

const save = async () => {
  if (isNew.value) {
    const data = await _save()
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

const { copy } = useClipboard()

const copyRecordUrl = () => {
  copy(`${dashboardUrl?.value}#/nc/${project.value?.id}/table/${meta.value?.title}?rowId=${primaryKey.value}`)
  message.success('Copied to clipboard')
}
</script>

<template>
  <div class="flex p-2 items-center gap-2 p-4">
    <h5 class="text-lg font-weight-medium flex items-center gap-1 mb-0 min-w-0 overflow-x-hidden truncate">
      <mdi-table-arrow-right :style="{ color: iconColor }" />

      <template v-if="meta">
        {{ meta.title }}
      </template>

      <!-- todo: table doesn't exist?
      <template v-else>
        {{ table }}
      </template>
      -->
      <template v-if="primaryValue">: {{ primaryValue }}</template>
    </h5>

    <div class="flex-1" />
    <a-tooltip placement="bottom">
      <template #title>
        <div class="text-center w-full">{{ $t('general.reload') }}</div>
      </template>
      <mdi-reload class="cursor-pointer select-none text-gray-500 mx-1" @click="loadRow" />
    </a-tooltip>
    <a-tooltip placement="bottom">
      <template #title>
        <!-- todo: i18n -->
        <div class="text-center w-full">Copy record URL</div>
      </template>
      <mdi-link v-if="!isNew" class="cursor-pointer select-none text-gray-500 mx-1" @click="copyRecordUrl" />
    </a-tooltip>
    <a-tooltip v-if="!isSqlView" placement="bottom">
      <!--      Toggle comments draw -->
      <template #title>
        <div class="text-center w-full">{{ $t('activity.toggleCommentsDraw') }}</div>
      </template>
      <MdiCommentTextOutline
        v-if="isUIAllowed('rowComments') && !isNew"
        v-e="['c:row-expand:comment-toggle']"
        class="cursor-pointer select-none nc-toggle-comments text-gray-500 mx-1"
        @click="commentsDrawer = !commentsDrawer"
      />
    </a-tooltip>

    <a-button class="!text mx-1" @click="emit('cancel')">
      <!-- Cancel -->
      {{ $t('general.cancel') }}
    </a-button>

    <a-button :disabled="!isUIAllowed('tableRowUpdate')" type="primary" class="mx-1" @click="save">
      <!-- Save Row -->
      {{ $t('activity.saveRow') }}
    </a-button>
  </div>
</template>

<style scoped></style>
