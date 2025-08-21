<script setup lang="ts">
import { useGroupedSettingsState } from '../lib/use-grouped-settings-state'

const props = defineProps<{
  title: string
  disabled?: boolean
  disabledTooltip?: string
}>()
const { state, updateState } = useGroupedSettingsState(props.title, !props.disabled)
const isOpen = ref(state.value)
watch(isOpen, updateState)

const handleToggleIsOpen = () => {
  if (props.disabled) return

  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="grouped-settings flex flex-col" :class="{ isOpen }">
    <NcTooltip :disabled="!disabled || !disabledTooltip" :title="disabledTooltip">
      <header
        class="flex justify-between items-center"
        :class="{ 'cursor-not-allowed': disabled, 'cursor-pointer': !disabled }"
        @click="handleToggleIsOpen"
      >
        <span class="text-bodyBold !font-semibold">{{ title }}</span>
        <NcButton size="xsmall" type="text" class="!w-7 !h-7 -my-1" :disabled="disabled" @click.stop="handleToggleIsOpen">
          <GeneralIcon :icon="isOpen ? 'ncChevronUp' : 'ncChevronDown'" class="w-4 h-4" />
        </NcButton>
      </header>
    </NcTooltip>
    <slot v-if="isOpen"></slot>
  </div>
</template>

<style lang="scss" scoped>
.grouped-settings {
  @apply gap-4 p-4 border-b-1 border-nc-border-gray-medium;
}
</style>
