<script lang="ts" setup>
import type { NcProjectType } from '~/utils/baseCreateUtils'

const props = defineProps<{
  item: {
    body: {
      base: {
        id: string
        title: string
        base_type: NcProjectType
      }
      comment: string
      row: {
        id: string
        value: string
      }
      table: {
        id: string
        title: string
      }
      user: {
        display_name: string
        email: string
        id: string
      }
      workspace: {
        id: string
        title: string
      }
    }
    created_at: any
  }
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
          type: item.body.base.base_type,
          query: {
            rowId: item.body.row.id,
            commentId: item.body.comment.id,
          },
        })
      }
    "
  >
    <template #avatar>
      <GeneralUserIcon class="w-12 h-12" :email="item.body.user.email" :name="item.body.user.display_name" />
    </template>
    <div class="text-sm">
      <p class="!mb-2">
        <strong>{{ item.body.user.display_name ?? item.body.user.email }}</strong> has mentioned you in a comment on
        <strong> {{ item.body.row.value }} </strong> {{ ' ' }}
        in
        <span class="inline-flex items-center gap-1">
          <strong>{{ item.body.table.title }} / </strong>
        </span>
        <span class="flex inline-flex items-center ml-1 gap-1">
          <strong>{{ item.body.base.title }}</strong>
        </span>
      </p>
      <span v-if="item.body.workspace.title" class="capitalize text-gray-600 bg-gray-200 rounded-lg px-2">
        {{ item.body.workspace.title }}
      </span>
    </div>
  </NotificationItemWrapper>
</template>
