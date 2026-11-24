<script setup lang="ts">
import { REACTION_EMOJIS } from 'nocodb-sdk'

const props = defineProps<{
  /** Emojis the current user has already reacted with. */
  reacted?: string[]
}>()

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
          class="nc-comment-reaction-picker-emoji flex items-center justify-center w-7 h-7 rounded-md border-1 cursor-pointer text-base transition-colors"
          :class="
            props.reacted?.includes(emoji)
              ? 'bg-nc-bg-brand border-nc-border-brand'
              : 'border-transparent hover:bg-nc-bg-gray-light'
          "
          :aria-pressed="!!props.reacted?.includes(emoji)"
          :data-testid="`nc-comment-react-${emoji}`"
          @click="pick(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </template>
  </NcDropdown>
</template>
