<script lang="ts" setup>
/* interface */

const props = defineProps<{
  disabled?: boolean
  tooltip?: string
  items: {
    label: string
    value: string
  }[]
}>()

const modelValue = defineModel<string>()
</script>

<template>
  <NcTooltip :disabled="!props.tooltip">
    <template #title>
      {{ props.tooltip }}
    </template>
    <NcDropdown :disabled="props.disabled" :class="{ 'pointer-events-none opacity-50': props.disabled }">
      <slot />
      <template #overlay>
        <div class="flex flex-col gap-1 p-1">
          <div
            v-for="item of props.items"
            :key="item.value"
            class="flex items-center justify-between px-2 py-1 rounded-md transition-colors hover:bg-gray-100 cursor-pointer"
            :class="{
              'bg-gray-100': modelValue === item.value,
            }"
            @click="modelValue = item.value"
          >
            <span>
              {{ item.label }}
            </span>
            <GeneralIcon v-if="modelValue === item.value" icon="check" class="text-primary" />
          </div>
        </div>
      </template>
    </NcDropdown>
  </NcTooltip>
</template>
