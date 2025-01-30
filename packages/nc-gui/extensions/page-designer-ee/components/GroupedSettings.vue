<script setup lang="ts">
defineProps<{
  title: string
}>()

const isOpen = ref(true)
</script>

<template>
  <div class="grouped-settings flex flex-col">
    <header class="flex justify-between items-center cursor-pointer" @click="isOpen = !isOpen">
      <span>{{ title }}</span>
      <NcButton size="xsmall" type="text" class="!w-7 !h-7" @click.stop="isOpen = !isOpen">
        <GeneralIcon :icon="isOpen ? 'ncChevronUp' : 'ncChevronDown'" class="w-4 h-4" />
      </NcButton>
    </header>
    <slot v-if="isOpen"></slot>
  </div>
</template>

<style lang="scss" scoped>
.grouped-settings {
  padding: 16px 24px;
  gap: 16px;
  header > span {
    font-size: 16px;
    font-weight: 700;
  }
  border-bottom: 1px solid;
  @apply border-nc-border-gray-medium;
}
</style>
