<script lang="ts" setup>
import { message } from 'ant-design-vue'
import type { ViewType } from 'nocodb-sdk'
import {
  ReloadRowDataHookInj,
  useExpandedFormStoreOrThrow,
  useSmartsheetRowStoreOrThrow,
  useSmartsheetStoreOrThrow,
  useUIPermission,
} from '#imports'

const props = defineProps<{ view?: ViewType }>()

const emit = defineEmits(['cancel'])

const route = useRoute()

const { meta, isSqlView } = useSmartsheetStoreOrThrow()

const { commentsDrawer, primaryValue, primaryKey, save: _save, loadRow } = useExpandedFormStoreOrThrow()

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

const { copy } = useClipboard()

const copyRecordUrl = () => {
  copy(
    encodeURI(
      `${dashboardUrl?.value}#/${route.params.projectType}/${route.params.projectId}/${route.params.type}/${meta.value?.title}${
        props.view ? `/${props.view.title}` : ''
      }?rowId=${primaryKey.value}`,
    ),
  )
  message.success('Copied to clipboard')
}
</script>

<template>
  <div class="flex p-2 items-center gap-2 p-4 nc-expanded-form-header">
    <h5 class="text-lg font-weight-medium flex items-center gap-1 mb-0 min-w-0 overflow-x-hidden truncate">
      <mdi-table-arrow-right :style="{ color: iconColor }" />

      <template v-if="meta">
        {{ meta.title }}
      </template>

      <template v-if="primaryValue">: {{ primaryValue }}</template>
    </h5>

    <div class="flex-1" />

    <a-tooltip placement="bottom">
      <template #title>
        <div class="text-center w-full">{{ $t('general.reload') }}</div>
      </template>
      <mdi-reload v-if="!isNew" class="cursor-pointer select-none text-gray-500 mx-1 min-w-4" @click="loadRow" />
    </a-tooltip>
    <a-tooltip placement="bottom">
      <template #title>
        <!-- todo: i18n -->
        <div class="text-center w-full">Copy record URL</div>
      </template>
      <mdi-link
        v-if="!isNew"
        class="cursor-pointer select-none text-gray-500 mx-1 nc-copy-row-url min-w-4"
        @click="copyRecordUrl"
      />
    </a-tooltip>

    <a-tooltip v-if="!isSqlView" placement="bottom">
      <!--      Toggle comments draw -->
      <template #title>
        <div class="text-center w-full">{{ $t('activity.toggleCommentsDraw') }}</div>
      </template>
      <MdiCommentTextOutline
        v-if="isUIAllowed('rowComments') && !isNew"
        v-e="['c:row-expand:comment-toggle']"
        class="cursor-pointer select-none nc-toggle-comments text-gray-500 mx-1 min-w-4"
        @click="commentsDrawer = !commentsDrawer"
      />
    </a-tooltip>

    <a-button class="!text mx-1 nc-expand-form-close-btn" @click="emit('cancel')">
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
