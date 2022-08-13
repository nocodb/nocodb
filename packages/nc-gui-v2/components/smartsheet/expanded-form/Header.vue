<script lang="ts" setup>
import {
  computed,
  useExpandedFormStoreOrThrow,
  useSmartsheetRowStoreOrThrow,
  useSmartsheetStoreOrThrow,
  useUIPermission,
} from '#imports'
import MdiDoorOpen from '~icons/mdi/door-open'
import MdiDoorClosed from '~icons/mdi/door-closed'

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

const drawerToggleIcon = computed(() => (commentsDrawer.value ? MdiDoorOpen : MdiDoorClosed))

// todo: accept as a prop / inject
const iconColor = '#1890ff'
</script>

<template>
  <div class="flex p-2 align-center gap-2 p-4">
    <h5 class="text-lg font-weight-medium flex align-center gap-1 mb-0 min-w-0 overflow-x-hidden truncate">
      <mdi-table-arrow-right :style="{ color: iconColor }" />

      <template v-if="meta">
        {{ meta.title }}
      </template>
      <template v-else>
        {{ table }}
      </template>
      <template v-if="primaryValue">: {{ primaryValue }}</template>
    </h5>
    <div class="flex-grow" />
    <mdi-reload class="cursor-pointer select-none" />
    <component :is="drawerToggleIcon" class="cursor-pointer select-none" @click="commentsDrawer = !commentsDrawer" />
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
