<script lang="ts" setup>
import type { MentionEventType } from 'nocodb-sdk'
import type { NcProjectType } from '~/utils/baseCreateUtils'

const props = defineProps<{
  item: MentionEventType
}>()

const { ncNavigateTo } = useGlobal()

const item = toRef(props, 'item')

const navigateTo = (item: MentionEventType) => {
  ncNavigateTo({
    baseId: item.body.base.id,
    tableId: item.body.table.id,
    workspaceId: item.body.workspace?.id ?? '',
    type: item.body.base.type as NcProjectType,
    query: {
      rowId: item.body.row.id,
      columnId: item.body.column?.id,
    },
  })
}
</script>

<template>
  <NotificationItemWrapper :item="item" @click="navigateTo(item)">
    <template #avatar>
      <GeneralUserIcon class="w-8 h-8" :email="item.body.user.email" :name="item.body.user.display_name" />
    </template>
    <div class="!mb-2">
      <div>
        <span class="font-semibold"
          >{{ item.body.user.display_name?.length ? item.body.user.display_name : item.body.user.email }}
        </span>
        has mentioned you in

        <span class="inline-flex">
          <LazySmartsheetPlainCell v-model="item.body.row.value" class="max-w-48" bold :column="item.body.row.column" />
        </span>

        in
        <span class="font-semibold">{{ item.body.table.title }} / </span>
        <span class="font-semibold"> {{ item.body.base.title }}</span>
      </div>
    </div>
    <span v-if="item.body.workspace.title" class="capitalize text-gray-600 bg-gray-200 rounded-lg !mt-2 px-2">
      {{ item.body.workspace.title }}
    </span>
  </NotificationItemWrapper>
</template>

<style scoped lang="scss">
:deep(.plain-cell) {
  @apply whitespace-nowrap overflow-hidden text-ellipsis;
}
</style>
