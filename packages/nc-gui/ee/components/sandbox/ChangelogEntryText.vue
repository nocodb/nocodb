<script setup lang="ts">
import { iconForChangelogKind, parseChangelogTokens } from '~/ee/utils/changelogTokens'

interface Props {
  description?: string
}

const props = defineProps<Props>()

const tokens = computed(() => parseChangelogTokens(props.description ?? ''))
</script>

<template>
  <span class="nc-changelog-entry-text">
    <template v-for="(token, i) in tokens" :key="i">
      <template v-if="token.type === 'text'">{{ token.value }}</template>

      <strong v-else-if="token.type === 'bold'">{{ token.value }}</strong>

      <span v-else class="nc-changelog-entity">
        <GeneralIcon
          v-if="iconForChangelogKind(token.kind)"
          :icon="iconForChangelogKind(token.kind) as string"
          class="nc-changelog-entity-icon"
        />
        <strong>{{ token.value }}</strong>
      </span>
    </template>
  </span>
</template>

<style lang="scss" scoped>
.nc-changelog-entity {
  @apply inline-flex items-center gap-1 align-middle;
}

.nc-changelog-entity-icon {
  @apply w-3.5 h-3.5 flex-none text-nc-content-gray-subtle;
}
</style>
