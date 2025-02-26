<script setup lang="ts">
import { useGroupedSettingsState } from '../lib/use-grouped-settings-state'

const props = defineProps<{
  title: string
}>()
const { state, updateState } = useGroupedSettingsState(props.title)
const isOpen = ref(state.value)
watch(isOpen, updateState)
</script>

<template>
  <div class="grouped-settings flex flex-col" :class="{ isOpen }">
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
  @apply gap-4 py-4 px-6 border-b-1 border-nc-border-gray-medium;
  header > span {
    @apply text-[16px] font-700;
  }
}
</style>
