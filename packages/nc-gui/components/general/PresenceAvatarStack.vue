<script setup lang="ts">
import type { PresenceStackUser } from '~/lib/types'

/** CE placeholder — presence is EE-only. */
interface Props {
  users?: PresenceStackUser[]
  maxVisible?: number
  maxTooltipNames?: number
  size?: 'small' | 'medium'
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
