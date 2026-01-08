<script setup lang="ts">
defineProps<{
  title?: string
}>()

const isOpen = ref(true)
</script>

<template>
  <div class="grouped-settings flex flex-col" :class="{ isOpen }">
    <header class="flex justify-between items-center cursor-pointer" @click="isOpen = !isOpen">
      <slot name="title">
        <span>{{ title }}</span>
      </slot>
      <NcButton size="xsmall" type="text" class="!w-7 !h-7" @click.stop="isOpen = !isOpen">
        <GeneralIcon :icon="isOpen ? 'ncChevronUp' : 'ncChevronDown'" class="w-4 h-4" />
      </NcButton>
    </header>
    <slot v-if="isOpen"></slot>
  </div>
</template>

<style lang="scss" scoped>
.grouped-settings {
  @apply gap-4 py-4 px-5 border-b-1 border-nc-border-gray-medium;
  header > span {
    @apply text-[16px] font-700;
  }
}
</style>
