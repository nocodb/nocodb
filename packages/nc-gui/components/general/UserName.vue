<script lang="ts" setup>
import type { UserType } from 'nocodb-sdk'

interface Props {
  user?: Partial<UserType> | Record<string, any> | null
  // Show a tooltip with the full name — only surfaces when the text is truncated.
  tooltip?: boolean
  // Fallback text when the user has neither a display name nor an email.
  fallback?: string
}

const props = withDefaults(defineProps<Props>(), {
  tooltip: true,
  fallback: '',
})

const { user, tooltip, fallback } = toRefs(props)

const displayName = computed(() => extractUserDisplayNameOrEmail(user.value ?? undefined) || fallback.value)
</script>

<template>
  <NcTooltip v-if="tooltip" class="nc-user-name truncate" show-on-truncate-only :title="displayName">
    {{ displayName }}
  </NcTooltip>
  <span v-else class="nc-user-name truncate">{{ displayName }}</span>
</template>
