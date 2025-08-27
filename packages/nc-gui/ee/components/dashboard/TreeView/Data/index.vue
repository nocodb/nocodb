<script setup lang="ts">
defineProps<{
  baseId: string
}>()

const isExpanded = ref(true)
</script>

<template>
  <div class="nc-project-home-section">
    <div class="nc-project-home-section-header !cursor-pointer" @click.stop="isExpanded = !isExpanded">
      <div class="flex-1">{{ $t('general.data') }}</div>

      <GeneralIcon
        icon="chevronRight"
        class="flex-none nc-sidebar-source-node-btns cursor-pointer transform transition-transform duration-200 text-[20px] text-nc-content-gray-muted"
        :class="{ '!rotate-90': isExpanded }"
      />
    </div>
    <DashboardTreeViewDataList v-if="isExpanded" :base-id="baseId!" />
  </div>
</template>
