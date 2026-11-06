<script setup lang="ts">
import type { EmojiSuggestionItem } from './index'

const props = defineProps<{
  items: EmojiSuggestionItem[]
  query: string
  command: (item: EmojiSuggestionItem) => void
}>()

const listRef = ref<HTMLElement>()

const selectedIndex = ref(0)

const hasNavigated = ref(false)

// ":" or ":D" then Enter is someone finishing a sentence, so Enter sends until the intent is clear.
const enterPicks = computed(() => hasNavigated.value || props.query.length >= 2)

function selectItem(index: number) {
  const item = props.items[index]
  if (item) props.command(item)
}

function onKeyDown({ event }: { event: KeyboardEvent }) {
  if (!props.items.length) return false

  if (event.key === 'ArrowUp') {
    selectedIndex.value = (selectedIndex.value + props.items.length - 1) % props.items.length
    hasNavigated.value = true
    return true
  }

  if (event.key === 'ArrowDown') {
    selectedIndex.value = (selectedIndex.value + 1) % props.items.length
    hasNavigated.value = true
    return true
  }

  if (event.key === 'Tab' || (event.key === 'Enter' && enterPicks.value)) {
    // Keep Enter from reaching the comment box, which would send the comment.
    event.stopPropagation()
    event.preventDefault()
    selectItem(selectedIndex.value)
    return true
  }

  return false
}

watch(
  () => props.items,
  () => {
    selectedIndex.value = 0
    hasNavigated.value = false
  },
)

watch(selectedIndex, () => {
  nextTick(() => listRef.value?.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' }))
})

defineExpose({ onKeyDown })
</script>

<template>
  <div
    v-show="items.length"
    ref="listRef"
    class="nc-emoji-suggestion-list w-56 bg-nc-bg-default nc-scrollbar-thin border-1 border-nc-border-gray-medium rounded-lg max-h-64 py-1"
    data-testid="nc-emoji-suggestion-list"
  >
    <div
      v-for="(item, index) in items"
      :key="item.id"
      :class="{ 'is-selected': index === selectedIndex }"
      class="nc-emoji-suggestion-item flex items-center gap-2 py-1.5 px-3 cursor-pointer text-nc-content-gray hover:bg-nc-bg-gray-light"
      @mouseenter="selectedIndex = index"
      @mousedown.prevent="selectItem(index)"
    >
      <span class="text-base leading-5">{{ item.native }}</span>
      <span class="truncate text-bodyDefaultSm">:{{ item.shortName }}:</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.is-selected {
  @apply bg-nc-bg-gray-light;
}
</style>
