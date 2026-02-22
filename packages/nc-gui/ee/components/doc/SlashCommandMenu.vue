<script setup lang="ts">
/**
 * Notion-style "/" command menu dropdown.
 *
 * Mounted by the SlashCommand extension into a tippy.js popup.
 * Supports keyboard navigation (↑/↓/Enter) — the extension calls
 * the exposed `onKeyDown` method.
 *
 * NOTE: This component is mounted via Vue's `createApp` (outside Nuxt),
 * so all imports must be explicit — no auto-imports available.
 */
import { ref, watch } from 'vue'
import type { SlashCommandItem } from './SlashCommand'

const props = defineProps<{
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}>()

const selectedIndex = ref(0)

watch(
  () => props.items,
  () => {
    selectedIndex.value = 0
  },
)

const selectItem = (index: number) => {
  const item = props.items[index]
  if (item) {
    props.command(item)
  }
}

const onKeyDown = (event: KeyboardEvent): boolean => {
  if (event.key === 'ArrowUp') {
    selectedIndex.value = (selectedIndex.value + props.items.length - 1) % props.items.length
    return true
  }
  if (event.key === 'ArrowDown') {
    selectedIndex.value = (selectedIndex.value + 1) % props.items.length
    return true
  }
  if (event.key === 'Enter') {
    selectItem(selectedIndex.value)
    return true
  }
  return false
}

defineExpose({ onKeyDown })
</script>

<template>
  <div v-if="items.length" class="nc-slash-menu">
    <div
      v-for="(item, index) in items"
      :key="item.title"
      class="nc-slash-menu-item"
      :class="{ 'is-selected': index === selectedIndex }"
      @click="selectItem(index)"
      @mouseenter="selectedIndex = index"
    >
      <span class="nc-slash-menu-icon" v-html="item.icon" />
      <span class="nc-slash-menu-label">{{ item.title }}</span>
    </div>
  </div>
</template>

<style>
/* Non-scoped — mounted outside Nuxt via createApp */
.nc-slash-menu {
  background: white;
  border-radius: 8px;
  padding: 4px 0;
  min-width: 200px;
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.nc-slash-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  cursor: pointer;
  transition: background-color 0.1s;
}

.nc-slash-menu-item.is-selected {
  background-color: #3366ff;
}

.nc-slash-menu-item.is-selected .nc-slash-menu-label {
  color: white;
}

.nc-slash-menu-item.is-selected .nc-slash-menu-icon {
  color: white;
}

.nc-slash-menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  color: #6b7280;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

.nc-slash-menu-icon svg {
  width: 18px;
  height: 18px;
}

.nc-slash-menu-label {
  font-size: 13px;
  font-weight: 400;
  color: #1f2937;
  line-height: 1;
}
</style>
