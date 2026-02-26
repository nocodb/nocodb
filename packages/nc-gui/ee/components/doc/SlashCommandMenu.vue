<script setup lang="ts">
/**
 * Notion-style "/" command menu dropdown.
 *
 * Mounted by the SlashCommand extension into a tippy.js popup.
 * Supports keyboard navigation (↑/↓/Enter) — the extension calls
 * the exposed `onKeyDown` method.
 *
 * When a command has `requiresInput: true`, the menu transitions to an
 * inline input mode instead of executing immediately. The user types a
 * value (e.g. a URL) and presses Enter to execute the command.
 *
 * NOTE: This component is mounted via Vue's `createApp` (outside Nuxt),
 * so all imports must be explicit — no auto-imports available.
 */
import { ref, watch, nextTick, computed } from 'vue'
import type { SlashCommandItem } from './SlashCommand'

const props = defineProps<{
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}>()

const selectedIndex = ref(0)
const menuRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

// --- Input mode state ---
const inputMode = ref(false)
const inputValue = ref('')
const pendingItem = ref<SlashCommandItem | null>(null)

/** Build grouped structure for rendering dividers between groups */
const groupedItems = computed(() => {
  const result: { group: string; items: { item: SlashCommandItem; globalIndex: number }[] }[] = []
  let currentGroup = ''
  let globalIndex = 0

  for (const item of props.items) {
    if (item.group !== currentGroup) {
      currentGroup = item.group
      result.push({ group: currentGroup, items: [] })
    }
    result[result.length - 1].items.push({ item, globalIndex })
    globalIndex++
  }
  return result
})

const scrollToSelected = () => {
  nextTick(() => {
    const el = menuRef.value?.querySelector('.is-selected') as HTMLElement | null
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  })
}

watch(
  () => props.items,
  () => {
    selectedIndex.value = 0
  },
)

const selectItem = (index: number) => {
  const item = props.items[index]
  if (!item) return

  if (item.requiresInput) {
    // Switch to input mode instead of executing
    pendingItem.value = item
    inputValue.value = ''
    inputMode.value = true
    nextTick(() => {
      inputRef.value?.focus()
    })
    return
  }

  props.command(item)
}

const submitInput = () => {
  const url = inputValue.value.trim()
  if (!url || !pendingItem.value) return

  // Create a synthetic item that captures the URL in its command closure.
  // The suggestion plugin will call syntheticItem.command(editor, range),
  // which injects the URL via editor.storage before the original command reads it.
  const original = pendingItem.value
  const syntheticItem: SlashCommandItem = {
    ...original,
    command: (editor, range) => {
      // Store URL where the original command can read it
      if (editor.storage.embed) {
        editor.storage.embed._pendingUrl = url
      }
      original.command(editor, range)
    },
  }

  inputMode.value = false
  pendingItem.value = null
  props.command(syntheticItem)
}

const cancelInput = () => {
  inputMode.value = false
  pendingItem.value = null
  inputValue.value = ''
}

const onKeyDown = (event: KeyboardEvent): boolean => {
  // In input mode, handle Enter/Escape only
  if (inputMode.value) {
    if (event.key === 'Enter') {
      submitInput()
      return true
    }
    if (event.key === 'Escape') {
      cancelInput()
      return true
    }
    // Let all other keys pass through to the input field
    return false
  }

  if (event.key === 'ArrowUp') {
    selectedIndex.value = (selectedIndex.value + props.items.length - 1) % props.items.length
    scrollToSelected()
    return true
  }
  if (event.key === 'ArrowDown') {
    selectedIndex.value = (selectedIndex.value + 1) % props.items.length
    scrollToSelected()
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
  <!-- Input mode: inline URL input replacing the menu -->
  <div v-if="inputMode" class="nc-slash-menu nc-slash-input-mode">
    <div class="nc-slash-input-row">
      <!-- SAFETY: icon is always a trusted SVG string from SlashCommand.ts — never user input -->
      <span class="nc-slash-menu-icon" v-html="pendingItem?.icon" />
      <input
        ref="inputRef"
        v-model="inputValue"
        class="nc-slash-input"
        :placeholder="pendingItem?.inputPlaceholder || $t('placeholder.enterUrl')"
        @keydown.enter.prevent="submitInput"
        @keydown.escape.prevent="cancelInput"
      />
    </div>
  </div>

  <!-- Normal menu mode -->
  <div v-else-if="items.length" ref="menuRef" class="nc-slash-menu">
    <template v-for="(group, gIdx) in groupedItems" :key="group.group">
      <div v-if="gIdx > 0" class="nc-slash-menu-divider" />
      <div class="nc-slash-menu-group-label">{{ group.group }}</div>
      <div
        v-for="entry in group.items"
        :key="entry.item.title"
        class="nc-slash-menu-item"
        :class="{ 'is-selected': entry.globalIndex === selectedIndex }"
        @click="selectItem(entry.globalIndex)"
        @mouseenter="selectedIndex = entry.globalIndex"
      >
        <!-- SAFETY: icon is always a trusted SVG string from SlashCommand.ts — never user input -->
        <span class="nc-slash-menu-icon" v-html="entry.item.icon" />
        <span class="nc-slash-menu-label">{{ entry.item.title }}</span>
      </div>
    </template>
  </div>
</template>

<style>
/* Non-scoped — mounted outside Nuxt via createApp.
 * Uses CSS variables (--nc-*) so colors adapt to dark mode. */
.nc-slash-menu {
  background: var(--nc-bg-default);
  border-radius: 8px;
  padding: 4px 0;
  min-width: 200px;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--nc-border-gray-medium);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.nc-slash-menu-divider {
  height: 1px;
  background: var(--nc-border-gray-medium);
  margin: 4px 12px;
}

.nc-slash-menu-group-label {
  padding: 4px 14px 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--nc-content-gray-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  user-select: none;
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
  background-color: var(--nc-fill-primary);
}

.nc-slash-menu-item.is-selected .nc-slash-menu-label {
  color: var(--nc-content-inverted-primary);
}

.nc-slash-menu-item.is-selected .nc-slash-menu-icon {
  color: var(--nc-content-inverted-primary);
}

/* Only override stroke on icons that use currentColor (non-brand icons) */
.nc-slash-menu-item.is-selected .nc-slash-menu-icon svg[stroke="currentColor"] {
  stroke: var(--nc-content-inverted-primary);
}

.nc-slash-menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  color: var(--nc-content-gray);
  flex-shrink: 0;
}

.nc-slash-menu-icon svg {
  width: 18px;
  height: 18px;
}

.nc-slash-menu-label {
  font-size: 13px;
  font-weight: 400;
  color: var(--nc-content-gray);
  line-height: 1;
}

/* Input mode styles */
.nc-slash-input-mode {
  padding: 6px 8px;
  min-width: 280px;
  max-height: none;
  overflow: visible;
}

.nc-slash-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nc-slash-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 13px;
  font-family: inherit;
  color: var(--nc-content-gray);
  background: transparent;
  padding: 4px 0;
  min-width: 0;
}

.nc-slash-input::placeholder {
  color: var(--nc-content-gray-muted);
}
</style>
