<script setup lang="ts">
import { AppEvents } from 'nocodb-sdk'

const props = defineProps<{
  item: any
}>()

const item = toRef(props, 'item')

const { navigateToProject } = useGlobal()

const isApproved = computed(() => item.value?.type === AppEvents.BASE_ACCESS_REQUEST_APPROVED)

const goToBase = () => {
  if (!isApproved.value) return
  const baseId = item.value?.body?.base?.id
  if (!baseId) return
  navigateToProject({
    baseId,
    workspaceId: item.value?.body?.base?.fk_workspace_id,
  })
}
</script>

<template>
  <NotificationItemWrapper :item="item" @click="goToBase">
    <div>
      <template v-if="isApproved">
        {{ $t('msg.info.editAccessApprovedFor') }}
        <span class="font-semibold">{{ item.body?.base?.title }}</span>.
      </template>
      <template v-else>
        {{ $t('msg.info.editAccessRejectedFor') }}
        <span class="font-semibold">{{ item.body?.base?.title }}</span>.
      </template>
    </div>
  </NotificationItemWrapper>
</template>
