<script setup lang="ts">
/**
 * Floating search & replace bar for the document editor.
 *
 * Positioned absolute at the top-right of the editor area (z-index 25,
 * above the page menu at z-index 20). When this bar is visible, the
 * page menu is hidden via `.nc-doc-page-menu-search-open` in Editor.vue.
 *
 * Layout:
 *   Row 1: [ search input ] [Aa] [.*]  [↑] [↓]  1/3  [⇄] [×]
 *   Row 2: [ replace input ] [Replace] [Replace All]   ← toggled by ⇄
 *
 * Keyboard:
 *   Enter       → next match
 *   Shift+Enter → previous match
 *   Escape      → close search bar
 *   @keydown.stop on container prevents editor from handling keys
 *
 * State sync:
 *   The component listens to editor `transaction` events to read the
 *   plugin state (match count, active index) from `searchPluginKey`.
 *   User input is debounced (150ms) before dispatching `setSearchQuery`.
 */
import type { Editor } from '@tiptap/vue-3'
import { searchPluginKey } from './DocSearchExtension'
import type { SearchState } from './DocSearchExtension'

interface Props {
  editor: Editor
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const { editor } = toRefs(props)

const { t } = useI18n()

// ── Refs ─────────────────────────────────────────────────────────────────

const searchInputRef = ref<HTMLInputElement>()
const replaceInputRef = ref<HTMLInputElement>()

// ── Reactive state ───────────────────────────────────────────────────────

const searchQuery = ref('')
const replaceText = ref('')
const caseSensitive = ref(false)
const useRegex = ref(false)
const isReplaceOpen = ref(false)

// Mirror of the ProseMirror plugin state — updated on each transaction
const searchState = ref<SearchState>({
  query: '',
  caseSensitive: false,
  regex: false,
  matches: [],
  activeIndex: 0,
})

// ── Plugin state sync ────────────────────────────────────────────────────

/** Read the latest search state from the ProseMirror plugin. */
const syncSearchState = () => {
  if (!editor.value) return
  const state = searchPluginKey.getState(editor.value.state)
  if (state) {
    searchState.value = { ...state }
  }
}

let unsubscribe: (() => void) | null = null

onMounted(() => {
  // Pre-populate search input with currently selected text (if any).
  // This matches the behavior of VS Code / Notion — select text, Cmd+F,
  // and the selection becomes the search query.
  if (editor.value) {
    const { from, to } = editor.value.state.selection
    if (from !== to) {
      const selectedText = editor.value.state.doc.textBetween(from, to, ' ')
      if (selectedText.trim()) {
        searchQuery.value = selectedText
        // Trigger search immediately (bypass the 150ms debounce)
        editor.value.commands.setSearchQuery(selectedText)
      }
    }
  }

  // Focus + select on mount so the user can immediately start typing
  nextTick(() => {
    searchInputRef.value?.focus()
    searchInputRef.value?.select()
  })

  // Subscribe to editor transactions to keep match count / active index in sync
  const handler = () => syncSearchState()
  editor.value?.on('transaction', handler)
  unsubscribe = () => editor.value?.off('transaction', handler)
})

onBeforeUnmount(() => {
  unsubscribe?.()
})

// ── Computed ─────────────────────────────────────────────────────────────

const matchCount = computed(() => searchState.value.matches.length)
const activeIndex = computed(() => searchState.value.activeIndex)

/** Display label: "2 / 5" when matches exist, "No results" when query has no hits. */
const matchLabel = computed(() => {
  if (!searchQuery.value) return ''
  if (matchCount.value === 0) return t('labels.noResults')
  return `${activeIndex.value + 1} / ${matchCount.value}`
})

// ── Search dispatch (debounced) ──────────────────────────────────────────

const debouncedSearch = useDebounceFn(() => {
  editor.value?.commands.setSearchQuery(searchQuery.value)
}, 150)

watch(searchQuery, () => debouncedSearch())

// Option toggles trigger an immediate rescan (no debounce needed)
watch(caseSensitive, (val) => editor.value?.commands.setSearchOptions({ caseSensitive: val }))
watch(useRegex, (val) => editor.value?.commands.setSearchOptions({ regex: val }))

// ── Actions ──────────────────────────────────────────────────────────────

function goNext() {
  editor.value?.commands.nextMatch()
}

function goPrev() {
  editor.value?.commands.prevMatch()
}

function replaceCurrent() {
  editor.value?.commands.replaceCurrent(replaceText.value)
}

function replaceAll() {
  editor.value?.commands.replaceAll(replaceText.value)
}

function close() {
  editor.value?.commands.clearSearch()
  emit('close')
}

// ── Keyboard handlers ────────────────────────────────────────────────────

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    e.shiftKey ? goPrev() : goNext()
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

function onReplaceKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    replaceCurrent()
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

// ── Public API (called from Editor.vue when Cmd+F is pressed while already open) ──

function focusSearch() {
  searchInputRef.value?.focus()
  searchInputRef.value?.select()
}

defineExpose({ focusSearch })
</script>

<template>
  <!-- @keydown.stop prevents keystrokes from reaching ProseMirror while the bar has focus -->
  <div
    class="nc-doc-search-bar"
    @keydown.stop
  >
    <!-- Row 1: Search input + toggles + navigation -->
    <div class="nc-doc-search-row">
      <div class="nc-doc-search-input-wrapper">
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          class="nc-doc-search-input"
          :placeholder="t('general.search')"
          data-testid="nc-doc-search-input"
          @keydown="onSearchKeydown"
        />
      </div>

      <!-- Case-sensitive toggle (Aa) -->
      <NcTooltip :title="t('labels.matchCase')" placement="bottom">
        <button
          class="nc-doc-search-toggle"
          :class="{ active: caseSensitive }"
          data-testid="nc-doc-search-case-toggle"
          @click="caseSensitive = !caseSensitive"
        >
          Aa
        </button>
      </NcTooltip>

      <!-- Regex toggle (.*) -->
      <NcTooltip :title="t('labels.useRegex')" placement="bottom">
        <button
          class="nc-doc-search-toggle"
          :class="{ active: useRegex }"
          data-testid="nc-doc-search-regex-toggle"
          @click="useRegex = !useRegex"
        >
          .*
        </button>
      </NcTooltip>

      <div class="nc-doc-search-divider" />

      <!-- Previous match -->
      <NcTooltip :title="t('labels.previous')" placement="bottom">
        <button
          class="nc-doc-search-nav-btn"
          :disabled="matchCount === 0"
          data-testid="nc-doc-search-prev"
          @click="goPrev"
        >
          <GeneralIcon icon="chevronUpSmall" />
        </button>
      </NcTooltip>

      <!-- Next match -->
      <NcTooltip :title="t('labels.next')" placement="bottom">
        <button
          class="nc-doc-search-nav-btn"
          :disabled="matchCount === 0"
          data-testid="nc-doc-search-next"
          @click="goNext"
        >
          <GeneralIcon icon="chevronDownSmall" />
        </button>
      </NcTooltip>

      <!-- Match counter (e.g. "2 / 5" or "No results") -->
      <span
        class="nc-doc-search-count"
        :class="{ 'nc-doc-search-count-empty': matchCount === 0 && searchQuery }"
        data-testid="nc-doc-search-count"
      >
        {{ matchLabel }}
      </span>

      <div class="nc-doc-search-divider" />

      <!-- Replace row toggle (swap icon ⇄) -->
      <NcTooltip :title="t('general.replace')" placement="bottom">
        <button
          class="nc-doc-search-nav-btn"
          :class="{ active: isReplaceOpen }"
          data-testid="nc-doc-search-replace-toggle"
          @click="isReplaceOpen = !isReplaceOpen"
        >
          <!-- Inline SVG: two opposing arrows (replace/swap icon) -->
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 3L13 5L11 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M3 5H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <path d="M5 13L3 11L5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M13 11H3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </NcTooltip>

      <!-- Close search bar -->
      <NcTooltip :title="t('general.close')" placement="bottom">
        <button
          class="nc-doc-search-nav-btn"
          data-testid="nc-doc-search-close"
          @click="close"
        >
          <GeneralIcon icon="close" />
        </button>
      </NcTooltip>
    </div>

    <!-- Row 2: Replace input + actions (visible when replace is expanded) -->
    <div v-if="isReplaceOpen" class="nc-doc-search-row nc-doc-replace-row">
      <div class="nc-doc-search-input-wrapper">
        <input
          ref="replaceInputRef"
          v-model="replaceText"
          class="nc-doc-search-input"
          :placeholder="t('labels.replaceWith')"
          data-testid="nc-doc-replace-input"
          @keydown="onReplaceKeydown"
        />
      </div>

      <NcButton
        size="xs"
        type="text"
        :disabled="matchCount === 0"
        data-testid="nc-doc-replace-btn"
        @click="replaceCurrent"
      >
        {{ t('general.replace') }}
      </NcButton>

      <NcButton
        size="xs"
        type="text"
        :disabled="matchCount === 0"
        data-testid="nc-doc-replace-all-btn"
        @click="replaceAll"
      >
        {{ t('labels.replaceAll') }}
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Floating search bar — absolute within the editor's relative wrapper
.nc-doc-search-bar {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 25; // Above nc-doc-page-menu (z-index: 20)
  background: var(--nc-bg-default);
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 380px;
  max-width: 480px;
}

.nc-doc-search-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nc-doc-search-input-wrapper {
  flex: 1;
  min-width: 0;
}

.nc-doc-search-input {
  width: 100%;
  padding: 4px 8px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--nc-content-gray);
  background: var(--nc-bg-gray-extralight);
  border: 1px solid transparent;
  border-radius: 4px;
  outline: none;
  transition: border-color 0.15s;

  &::placeholder {
    color: var(--nc-content-gray-muted);
  }

  &:focus {
    border-color: var(--nc-fill-primary);
    background: var(--nc-bg-default);
  }
}

// Toggle buttons for case-sensitive (Aa) and regex (.*)
.nc-doc-search-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--nc-content-gray-subtle);
  font-size: 12px;
  font-weight: 600;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--nc-bg-gray-light);
    color: var(--nc-content-gray);
  }

  &.active {
    background: var(--nc-bg-brand-soft);
    color: var(--nc-content-brand);
    border-color: var(--nc-border-brand);
  }
}

// Navigation + action icon buttons (prev, next, replace toggle, close)
.nc-doc-search-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--nc-content-gray-subtle);
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: var(--nc-bg-gray-light);
    color: var(--nc-content-gray);
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }

  &.active {
    background: var(--nc-bg-brand-soft);
    color: var(--nc-content-brand);
  }
}

.nc-doc-search-divider {
  width: 1px;
  height: 16px;
  background: var(--nc-border-gray-medium);
  margin: 0 2px;
  flex-shrink: 0;
}

.nc-doc-search-count {
  font-size: 12px;
  color: var(--nc-content-gray-subtle);
  white-space: nowrap;
  min-width: 36px;
  text-align: center;

  &.nc-doc-search-count-empty {
    color: var(--nc-content-red-medium);
  }
}

.nc-doc-replace-row {
  .nc-button {
    flex-shrink: 0;
  }
}
</style>
