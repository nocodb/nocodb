<script setup lang="ts">
import { type NotificationType, type PlanFeatureTypes, type PlanLimitTypes, getUpgradeMessage } from 'nocodb-sdk'

const props = defineProps<{
  item: NotificationType & {
    body: {
      workspace: {
        id: string
        title: string
      }
      requester: {
        id: string
        display_name: string | null
        email: string
      }
      limitOrFeature: PlanLimitTypes | PlanFeatureTypes
    }
  }
}>()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper :item="item" @click="navigateTo(`/${item.body.workspace.id}/settings?tab=billing`)">
    <div>
      <span class="font-semibold">{{ item.body.requester.display_name ?? item.body.requester.email }}</span> has requested an
      upgrade for the <span class="font-semibold">{{ item.body.workspace.title }}</span> workspace
      {{ getUpgradeMessage(item.body.limitOrFeature) }}
    </div>
  </NotificationItemWrapper>
</template>
