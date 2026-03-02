<script lang="ts" setup>
import type { NotificationType } from 'nocodb-sdk'

const props = defineProps<{
  item: NotificationType
}>()

const { ncNavigateTo } = useGlobal()

const item = toRef(props, 'item')

const body = computed(() => item.value.body as Record<string, any>)

const isCommentMention = computed(() => !!body.value?.comment)

const displayName = computed(() => body.value?.user?.display_name || body.value?.user?.email || '')

const navigateTo = () => {
  ncNavigateTo({
    workspaceId: body.value?.workspace?.id ?? '',
    baseId: body.value?.base?.id,
    docId: body.value?.doc?.id,
    docTitle: body.value?.doc?.title,
  })
}
</script>

<template>
  <NotificationItemWrapper :item="item" @click="navigateTo">
    <template #avatar>
      <GeneralUserIcon class="w-8 h-8" :user="body.user" />
    </template>
    <div class="!mb-2">
      <div>
        <span class="font-semibold">{{ displayName }} </span>
        <template v-if="isCommentMention">
          has mentioned you in a comment on
        </template>
        <template v-else>
          has mentioned you in
        </template>
        <span class="font-semibold">{{ body.doc?.title }}</span>
        in
        <span class="font-semibold">{{ body.base?.title }}</span>
      </div>
    </div>
    <span
      v-if="body.workspace?.title"
      class="capitalize text-nc-content-gray-subtle2 bg-nc-bg-gray-medium rounded-lg !mt-2 px-2"
    >
      {{ body.workspace.title }}
    </span>
  </NotificationItemWrapper>
</template>
