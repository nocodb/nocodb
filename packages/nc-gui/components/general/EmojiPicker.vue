<script lang="ts" setup>
import data from 'emoji-mart-vue-fast/data/apple.json'
import 'emoji-mart-vue-fast/css/emoji-mart.css'
import { Icon } from '@iconify/vue'
import { EmojiIndex, Picker } from 'emoji-mart-vue-fast/src'

const props = defineProps<{
  emoji?: string | undefined
  size?: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge'
  readonly?: boolean
  disableClearing?: boolean
  containerClass?: string
}>()

const emit = defineEmits(['emojiSelected'])

const { emoji: initialEmoji, size = 'medium', readonly, containerClass } = props

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

const showClearButton = computed(() => {
  return !!emojiRef.value && clearable.value
})

watch(isOpen, (val) => {
  if (!val) return
  nextTick(() => {
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('.emoji-mart-search input')
      if (!input) return
      input.focus()
      input.select()
    }, 250)
  })
})
</script>

<template>
  <NcDropdown v-model:visible="isOpen" :disabled="readonly" destroy-popup-on-hide overlay-class-name="overflow-hidden">
    <div
      class="flex-none flex flex-row justify-center items-center select-none rounded-md nc-emoji"
      :class="[
        {
          'hover:bg-gray-500 hover:bg-opacity-15 cursor-pointer': !readonly,
          'bg-gray-500 bg-opacity-15': isOpen,
          'h-4 w-4 text-[16px] leading-4': size === 'xsmall',
          'h-6 w-6 text-lg': size === 'small',
          'h-8 w-8 text-xl': size === 'medium',
          'h-10 w-10 text-2xl': size === 'large',
          'h-14 w-16 text-5xl': size === 'xlarge',
        },
        containerClass,
      ]"
      @click="onClick"
    >
      <template v-if="!emojiRef">
        <slot name="default" />
      </template>
      <template v-else-if="isUnicodeEmoji(emojiRef)">
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
        <Picker
          :data="emojiIndex"
          :native="true"
          :show-preview="false"
          color="#40444D"
          :auto-focus="true"
          class="nc-emoji-picker"
          @select="selectEmoji"
          @click.stop="() => {}"
        >
        </Picker>
        <div v-if="showClearButton" class="absolute top-10 right-1.5">
          <div
            role="button"
            class="flex flex-row items-center h-[32px] -mt-[1px] bg-white border-1 border-gray-100 py-0.5 px-2.5 rounded hover:bg-gray-100 cursor-pointer"
            @click="clearEmoji"
          >
            Remove
          </div>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.clearable {
  .emoji-mart-search {
    @apply pr-22;
  }
}
.nc-emoji-picker.emoji-mart {
  @apply !w-90;
  @apply border-none;

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
      @apply text-sm pl-[11px] rounded-lg !py-5px transition-all duration-300 !outline-none ring-0;

      &:focus {
        @apply !outline-none ring-0 shadow-selected border-primary;
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
