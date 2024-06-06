<script lang="ts" setup>
import type { MentionEventType } from 'nocodb-sdk'
import type { NcProjectType } from '~/utils/baseCreateUtils'

const props = defineProps<{
  item: MentionEventType
}>()

const { ncNavigateTo } = useGlobal()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper
    :item="item"
    @click="
      () => {
        ncNavigateTo({
          baseId: item.body.base.id,
          tableId: item.body.table.id,
          workspaceId: item.body.workspace?.id ?? '',
          type: item.body.base.type as NcProjectType,
          query: {
            rowId: item.body.row.id,
            commentId: item.body.comment.id,
          },
        })
      }
    "
  >
    <template #avatar>
      <GeneralUserIcon class="w-8 h-8" :email="item.body.user.email" :name="item.body.user.display_name" />
    </template>
    <div>
      <p class="!mb-2">
        <strong>{{ item.body.user.display_name ?? item.body.user.email }}</strong> has mentioned you in a comment on
        <strong> {{ item.body.row.value }} </strong> {{ ' ' }}
        in
        <span class="inline-flex items-center gap-1">
          <strong>{{ item.body.table.title }} / </strong>
        </span>
        <span class="flex inline-flex items-center gap-1">
          <strong> {{ item.body.base.title }}</strong>
        </span>
      </p>
      <span v-if="item.body.workspace.title" class="capitalize text-gray-600 bg-gray-200 rounded-lg px-2">
        {{ item.body.workspace.title }}
      </span>
    </div>
  </NotificationItemWrapper>
</template>
