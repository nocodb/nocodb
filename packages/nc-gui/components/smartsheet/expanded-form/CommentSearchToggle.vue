<script setup lang="ts">
const open = defineModel<boolean>({ default: false })
</script>

<template>
  <NcTooltip :title="$t('activity.searchComments')" placement="top" :arrow="false" :disabled="open" class="flex">
    <NcButton
      v-e="['c:comment:search:toggle', { open: !open }]"
      type="text"
      size="small"
      icon-only
      :class="{ '!bg-nc-bg-gray-medium': open }"
      :aria-label="$t('activity.searchComments')"
      :aria-pressed="open"
      data-testid="nc-comment-search-toggle"
      @click="open = !open"
    >
      <template #icon>
        <GeneralIcon icon="search" class="w-4 h-4 text-nc-content-gray-muted" />
      </template>
    </NcButton>
  </NcTooltip>
</template>
