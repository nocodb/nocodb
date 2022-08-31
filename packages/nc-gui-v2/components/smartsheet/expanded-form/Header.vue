<script lang="ts" setup>
import { useExpandedFormStoreOrThrow, useSmartsheetRowStoreOrThrow, useSmartsheetStoreOrThrow, useUIPermission } from '#imports'

const emit = defineEmits(['cancel'])

const { meta } = useSmartsheetStoreOrThrow()

const { commentsDrawer, primaryValue, save: _save } = useExpandedFormStoreOrThrow()

const { isNew, syncLTARRefs } = useSmartsheetRowStoreOrThrow()

const { isUIAllowed } = useUIPermission()

const save = async () => {
  if (isNew.value) {
    const data = await _save()
    await syncLTARRefs(data)
  } else {
    await _save()
  }
}

// todo: accept as a prop / inject
const iconColor = '#1890ff'
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
        <div class="text-center w-full">Reload</div>
      </template>
      <mdi-reload class="cursor-pointer select-none text-gray-500" />
    </a-tooltip>
    <a-tooltip placement="bottom">
      <template #title>
        <div class="text-center w-full">Toggle comments draw</div>
      </template>
      <MdiCommentTextOutline
        v-if="isUIAllowed('rowComments') && !isNew"
        class="cursor-pointer select-none nc-toggle-comments text-gray-500"
        @click="commentsDrawer = !commentsDrawer"
      />
    </a-tooltip>

    <a-button class="!text" @click="emit('cancel')">
      <!-- Cancel -->
      {{ $t('general.cancel') }}
    </a-button>

    <a-button :disabled="!isUIAllowed('tableRowUpdate')" type="primary" @click="save">
      <!-- Save Row -->
      {{ $t('activity.saveRow') }}
    </a-button>
  </div>
</template>

<style scoped></style>
