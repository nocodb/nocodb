<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    path?: Array<number> | null
    onNewRecordToGridClick: () => void
    onNewRecordToFormClick: () => void
    removeInlineAddRecord?: boolean
  }>(),
  {
    path: () => [],
  },
)

const { removeInlineAddRecord } = toRefs(props)

const { isAddNewRecordGridMode } = useGlobal()
</script>

<template>
  <NcMenu variant="small">
    <NcMenuItem
      v-e="['c:row:add:grid']"
      class="nc-new-record-with-grid group"
      :disabled="removeInlineAddRecord"
      @click="onNewRecordToGridClick(path ?? [])"
    >
      <div class="flex flex-row flex-1 items-center justify-start gap-x-3">
        <component :is="viewIcons[ViewTypes.GRID]?.icon" class="nc-view-icon text-inherit" />
        {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.grid') }}
      </div>

      <GeneralIcon v-if="isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
    </NcMenuItem>
    <NcMenuItem v-e="['c:row:add:form']" class="nc-new-record-with-form group" @click="onNewRecordToFormClick(path ?? [])">
      <div class="flex flex-row items-center flex-1 justify-start gap-x-3">
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
