<script setup lang="ts">
import { vOnClickOutside } from '@vueuse/components'
const picked = defineModel<string>()

const isOpen = ref(false)

function updatePicked(val: string) {
  picked.value = val
}
</script>

<template>
  <NcDropdown :auto-close="false" :visible="isOpen">
    <a-input :value="picked" class="!rounded-lg" @click="isOpen = !isOpen">
      <template #prefix>
        <div :style="`background: ${picked};`" class="h-6 w-6 rounded-full border-1 border-nc-border-gray-medium"></div>
      </template>
      <template #suffix>
        <GeneralIcon :icon="isOpen ? 'arrowUp' : 'arrowDown'" class="w-4 h-4" @click="isOpen = !isOpen" />
      </template>
    </a-input>
    <template #overlay>
      <GeneralAdvanceColorPicker
        v-model="picked"
        v-on-click-outside="() => (isOpen = false)"
        :is-open="isOpen"
        @input="updatePicked"
      />
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.color-property-picker {
}
</style>
