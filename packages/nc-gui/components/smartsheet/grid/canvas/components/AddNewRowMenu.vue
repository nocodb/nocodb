<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'

defineProps<{
  path: Array<number>
  onNewRecordToGridClick: () => void
  onNewRecordToFormClick: () => void
}>()

const { isAddNewRecordGridMode, setAddNewRecordGridMode } = useGlobal()
</script>

<template>
  <NcMenu variant="small">
    <NcMenuItem v-e="['c:row:add:grid']" class="nc-new-record-with-grid group" @click="onNewRecordToGridClick(path ?? [])">
      <div class="flex flex-row items-center justify-start gap-x-3">
        <component :is="viewIcons[ViewTypes.GRID]?.icon" class="nc-view-icon text-inherit" />
        {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.grid') }}
      </div>

      <GeneralIcon v-if="isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
    </NcMenuItem>
    <NcMenuItem v-e="['c:row:add:form']" class="nc-new-record-with-form group" @click="onNewRecordToFormClick(path ?? [])">
      <div class="flex flex-row items-center justify-start gap-x-3">
        <component :is="viewIcons[ViewTypes.FORM]?.icon" class="nc-view-icon text-inherit" />
        {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.form') }}
      </div>

      <GeneralIcon v-if="!isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
    </NcMenuItem>
  </NcMenu>
</template>

<style scoped lang="scss">
:deep(.nc-menu-item-inner) {
  @apply w-full;
}
</style>
