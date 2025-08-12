<script setup lang="ts">
import { vOnClickOutside } from '@vueuse/components'
const picked = defineModel<string>()

const isOpen = ref(false)

function updatePicked(val: string) {
  picked.value = val
}

const uniqueClass = `color-property-picker-${useId()}`
</script>

<template>
  <NcDropdown
    :auto-close="false"
    :visible="isOpen"
    :overlay-class-name="isOpen ? 'active' : ''"
    class="color-property-picker"
    :class="[uniqueClass]"
  >
    <a-input class="nc-input-sm nc-input-shadow" :value="picked?.toUpperCase()" readonly @click="isOpen = !isOpen">
      <template #prefix>
        <div
          :style="`background: ${picked};`"
          class="h-6 w-6 cursor-pointer rounded-full border-1 border-nc-border-gray-medium"
          @click="isOpen = !isOpen"
        ></div>
      </template>
      <template #suffix>
        <GeneralIcon :icon="isOpen ? 'arrowUp' : 'arrowDown'" class="w-4 h-4 cursor-pointer" @click="isOpen = !isOpen" />
      </template>
    </a-input>
    <template #overlay>
      <GeneralAdvanceColorPicker
        v-model="picked"
        v-on-click-outside="[() => (isOpen = false), { ignore: [`.${uniqueClass}`] }]"
        :is-open="isOpen"
        include-black-and-white-as-default-colors
        @input="updatePicked"
      />
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.color-property-picker {
  :deep(.ant-input) {
    @apply cursor-pointer;
  }
}
</style>
