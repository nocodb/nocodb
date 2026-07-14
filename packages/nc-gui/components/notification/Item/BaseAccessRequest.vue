<script setup lang="ts">
const props = defineProps<{
  item: any
}>()

const item = toRef(props, 'item')

const { navigateToProject } = useGlobal()

const goToReview = () => {
  const baseId = item.value?.body?.base?.id
  if (!baseId) return
  navigateToProject({
    baseId,
    workspaceId: item.value?.body?.base?.fk_workspace_id,
    query: { page: 'collaborator' },
  })
}
</script>

<template>
  <NotificationItemWrapper :item="item" @click="goToReview">
    <div>
      <span class="font-semibold">{{ item.body?.user?.displayName ?? item.body?.user?.email }}</span>
      {{ $t('msg.info.requestedEditAccessOn') }}
      <span class="font-semibold">{{ item.body?.base?.title }}</span>
      {{ $t('objects.project') }}.
    </div>
  </NotificationItemWrapper>
</template>
