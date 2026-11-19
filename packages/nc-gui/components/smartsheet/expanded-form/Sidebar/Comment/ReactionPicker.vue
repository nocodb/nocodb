<script setup lang="ts">
import { REACTION_EMOJIS } from 'nocodb-sdk'

const emits = defineEmits<{
  (e: 'react', emoji: string): void
}>()

const isOpen = ref(false)

function pick(emoji: string) {
  isOpen.value = false
  emits('react', emoji)
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen" placement="bottomRight">
    <slot :is-open="isOpen" />

    <template #overlay>
      <div class="flex items-center gap-0.5 p-1.5" data-testid="nc-comment-reaction-picker">
        <button
          v-for="emoji in REACTION_EMOJIS"
          :key="emoji"
          type="button"
          class="nc-comment-reaction-picker-emoji flex items-center justify-center w-7 h-7 rounded-md hover:bg-nc-bg-gray-light cursor-pointer text-base transition-colors"
          :data-testid="`nc-comment-react-${emoji}`"
          @click="pick(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </template>
  </NcDropdown>
</template>
