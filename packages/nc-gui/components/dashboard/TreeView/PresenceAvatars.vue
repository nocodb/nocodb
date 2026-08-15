<script setup lang="ts">
import type { PresencePageType } from 'nocodb-sdk'

// CE stub — collaborator presence is EE-only. The EE overlay at
// ee/components/dashboard/TreeView/PresenceAvatars.vue provides the real implementation;
// keeping the same Props shape means callers need no branching beyond their `isEeUI` guard.
interface Props {
  resourceId?: string
  pageType?: PresencePageType
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
