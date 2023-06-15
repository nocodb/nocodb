<script lang="ts" setup>
import data from 'emoji-mart-vue-fast/data/apple.json'
import 'emoji-mart-vue-fast/css/emoji-mart.css'
import { onClickOutside } from '@vueuse/core'

import { EmojiIndex, Picker } from 'emoji-mart-vue-fast/src'

const props = defineProps<{
  emoji?: string | undefined
  size: 'small' | 'medium' | 'large'
}>()

const emit = defineEmits(['emojiSelected'])

const { emoji, size = 'medium' } = props

const emojiIndex = new EmojiIndex(data)
const emojisOutput = ref(emoji || '🙂')
const emojiMartDomRef = ref<HTMLDivElement>()

function showEmoji(emoji: any) {
  emojisOutput.value = emoji.native
  emit('emojiSelected', emoji.native)
}

const isOpen = ref(false)

onClickOutside(emojiMartDomRef, () => (isOpen.value = false))
</script>

<template>
  <div
    class="nc-emoji-picker h-8 w-8 overflow-visible relative hover:bg-gray-100 rounded select-none"
    :class="{
      'bg-gray-100': isOpen,
      'h-6 w-6 text-sm': size === 'small',
      'h-8 w-8 text-base': size === 'medium',
      'h-10 w-10 text-lg': size === 'large',
    }"
    @click="isOpen = !isOpen"
  >
    <div
      class="h-full w-full flex flex-row justify-center items-center select-none cursor-pointer"
      :class="{
        'text-base': size === 'small',
        'text-lg': size === 'medium',
        'text-xl': size === 'large',
      }"
    >
      {{ emojisOutput }}
    </div>

    <div
      class="absolute z-40"
      :class="{
        'top-7': size === 'small',
        'top-9': size === 'medium',
        'top-11': size === 'large',
      }"
    >
      <Picker
        v-if="isOpen"
        ref="emojiMartDomRef"
        :data="emojiIndex"
        :native="true"
        :show-preview="false"
        color="#000000"
        :auto-focus="true"
        @select="showEmoji"
        @click.stop="() => {}"
      />
    </div>
  </div>
</template>

<style lang="scss">
.emoji-mart {
  @apply !w-90;

  span.emoji-type-native {
    @apply cursor-pointer;
  }

  .emoji-mart-anchor {
    @apply h-8 py-1.5;
    svg {
      @apply h-3.5 !important;
    }
  }
  .emoji-mart-search {
    input {
      @apply text-sm;
      // Remove focus outline
      &:focus {
        @apply !outline-none border-0 mt-0.2 mb-0.2;
      }
    }
  }

  .emoji-mart-scroll {
    @apply mt-1 pl-1 pr-2 overflow-x-hidden;

    h3.emoji-mart-category-label {
      @apply text-sm text-gray-600;
    }

    .emoji-mart-category {
      @apply w-88;
    }
  }

  .emoji-mart-scroll {
    overflow-y: overlay;

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-track {
      background: #f6f6f600 !important;
    }
    &::-webkit-scrollbar-thumb {
      background: #f6f6f600;
    }
    &::-webkit-scrollbar-thumb:hover {
      background: #f6f6f600;
    }
  }
  .emoji-mart-scroll:hover {
    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-track {
      background: #f6f6f600 !important;
    }
    &::-webkit-scrollbar-thumb {
      background: rgb(215, 215, 215);
    }
    &::-webkit-scrollbar-thumb:hover {
      background: rgb(203, 203, 203);
    }
  }
}
</style>
