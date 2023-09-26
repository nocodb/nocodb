<script lang="ts" setup>
import data from 'emoji-mart-vue-fast/data/apple.json'
import 'emoji-mart-vue-fast/css/emoji-mart.css'
import { Icon } from '@iconify/vue'

import { EmojiIndex, Picker } from 'emoji-mart-vue-fast/src'

const props = defineProps<{
  emoji?: string | undefined
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  readonly?: boolean
  disableClearing?: boolean
}>()

const emit = defineEmits(['emojiSelected'])

const { emoji: initialEmoji, size = 'medium', readonly } = props

const clearable = computed(() => {
  return !props.disableClearing && !readonly
})

const isOpen = ref(false)
const emojiIndex = new EmojiIndex(data, {
  emojisToShowFilter: (emoji: any) => {
    if (Number(emoji.added_in) >= 14) {
      return false
    }

    return true
  },
})
const emojiRef = ref(initialEmoji || '')

function selectEmoji(_emoji: any) {
  emojiRef.value = _emoji.native
  emit('emojiSelected', _emoji.native)

  isOpen.value = false
}

const isUnicodeEmoji = computed(() => {
  return emojiRef.value?.match(/\p{Extended_Pictographic}/gu)
})

const onClick = (e: Event) => {
  if (readonly) return

  e.stopPropagation()

  isOpen.value = !isOpen.value
}

const clearEmoji = () => {
  emojiRef.value = ''
  emit('emojiSelected', '')

  isOpen.value = false
}

// Due to calculation of dropdown position by ant dropdown, we need to delay the isOpen change
// otherwise dropdown opening will be slow
const debounceIsOpen = ref(false)
watch(isOpen, () => {
  if (!isOpen.value) {
    debounceIsOpen.value = isOpen.value
    return
  }

  setTimeout(() => {
    debounceIsOpen.value = isOpen.value
  }, 10)
})

const showClearButton = computed(() => {
  return !!emojiRef.value && clearable.value
})
</script>

<template>
  <a-dropdown v-model:visible="isOpen" :trigger="['click']" :disabled="readonly">
    <div
      class="flex flex-row justify-center items-center select-none rounded-md nc-emoji"
      :class="{
        'hover:bg-gray-500 hover:bg-opacity-15 cursor-pointer': !readonly,
        'bg-gray-500 bg-opacity-15': isOpen,
        'h-6 w-6 text-lg': size === 'small',
        'h-8 w-8 text-xl': size === 'medium',
        'h-10 w-10 text-2xl': size === 'large',
        'h-14 w-16 text-5xl': size === 'xlarge',
      }"
      @click="onClick"
    >
      <template v-if="!emojiRef">
        <slot name="default" />
      </template>
      <template v-else-if="isUnicodeEmoji">
        {{ emojiRef }}
      </template>
      <template v-else>
        <Icon :data-testid="`nc-icon-${emojiRef}`" class="text-lg" :icon="emojiRef"></Icon>
      </template>
    </div>
    <template #overlay>
      <div
        class="relative"
        :class="{
          clearable: showClearButton,
        }"
      >
        <div v-if="!debounceIsOpen" class="h-105 w-90"></div>
        <Picker
          v-else
          :data="emojiIndex"
          :native="true"
          :show-preview="false"
          color="#40444D"
          :auto-focus="true"
          @select="selectEmoji"
          @click.stop="() => {}"
        >
        </Picker>
        <div v-if="debounceIsOpen && showClearButton" class="absolute top-10 right-1.5">
          <div
            role="button"
            class="flex flex-row items-center bg-white border-1 border-gray-100 py-0.5 px-2.5 rounded hover:bg-gray-100 cursor-pointer"
            @click="clearEmoji"
          >
            Remove
          </div>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>

<style lang="scss">
.clearable {
  .emoji-mart-search {
    @apply pr-22;
  }
}
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
      @apply text-sm pl-3.5 rounded;
      // Remove focus outline
      &:focus {
        @apply !outline-none border-0 mt-0.2 mb-0.2;
      }
    }
  }

  .emoji-mart-scroll {
    @apply mt-1 px-1 overflow-x-hidden;

    h3.emoji-mart-category-label {
      @apply text-xs text-gray-500 mb-0;
    }

    .emoji-mart-category {
      @apply w-88;
    }
  }

  .emoji-mart-scroll {
    overflow-y: overlay;

    &::-webkit-scrollbar {
      width: 3px;
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
      width: 3px;
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

  .emoji-mart-emoji {
    @apply !px-1 !py-0.75 !m-0.5;
  }
  .emoji-mart-emoji:hover:before {
    @apply !rounded-md;
  }
}
</style>
