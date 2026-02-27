<script setup lang="ts">
/**
 * NodeView component for syntax-highlighted code blocks.
 *
 * Responsibilities:
 * - Render code with lowlight syntax highlighting (via NodeViewContent)
 * - Language selector dropdown (searchable, grouped list)
 * - Copy-to-clipboard button
 * - Toolbar visible on hover
 */
import { NodeViewContent, NodeViewWrapper } from '@tiptap/vue-3'
import {
  ALL_LANGUAGES,
  type CodeBlockLanguage,
  PLAIN_TEXT,
  POPULAR_LANGUAGES,
  getLanguageLabel,
  matchesSearch,
} from './DocCodeBlockLanguages'

const props = defineProps<{
  node: any
  updateAttributes: (attrs: Record<string, any>) => void
  deleteNode: () => void
  selected: boolean
  editor: any
}>()

const { copy } = useCopy()

const { t } = useI18n()

// --- Language ---
const currentLanguage = computed(() => props.node.attrs.language || '')

const currentLanguageLabel = computed(() => getLanguageLabel(currentLanguage.value))

// --- Dropdown ---
const isDropdownOpen = ref(false)

const setLanguage = (lang: CodeBlockLanguage) => {
  props.updateAttributes({ language: lang.id || null })
  isDropdownOpen.value = false
}

const searchQuery = ref('')

const searchInputRef = ref<HTMLInputElement>()

const filteredPopular = computed(() => {
  if (!searchQuery.value) return POPULAR_LANGUAGES
  return POPULAR_LANGUAGES.filter((l) => matchesSearch(l, searchQuery.value))
})

const filteredOther = computed(() => {
  if (!searchQuery.value) return ALL_LANGUAGES
  return ALL_LANGUAGES.filter((l) => matchesSearch(l, searchQuery.value))
})

const showPlainText = computed(() => {
  if (!searchQuery.value) return true
  return 'plain text'.includes(searchQuery.value.toLowerCase())
})

// Flat list for keyboard navigation
const flatFiltered = computed(() => {
  const items: CodeBlockLanguage[] = []
  if (showPlainText.value) items.push(PLAIN_TEXT)
  items.push(...filteredPopular.value)
  items.push(...filteredOther.value)
  return items
})

const activeIndex = ref(-1)

const onArrowDown = () => {
  activeIndex.value = Math.min(activeIndex.value + 1, flatFiltered.value.length - 1)
  nextTick(() => {
    const el = document.querySelector('.nc-code-block-lang-option.nc-active')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

const onArrowUp = () => {
  activeIndex.value = Math.max(activeIndex.value - 1, 0)
  nextTick(() => {
    const el = document.querySelector('.nc-code-block-lang-option.nc-active')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

const onEnter = () => {
  const item = flatFiltered.value[activeIndex.value]
  if (item) setLanguage(item)
}

watch(isDropdownOpen, (open) => {
  if (open) {
    searchQuery.value = ''
    activeIndex.value = -1
    nextTick(() => searchInputRef.value?.focus())
  }
})

// Helper to compute the flat index for a language in the filtered list
const flatIndex = (sectionOffset: number, localIndex: number) => {
  return sectionOffset + localIndex
}

const popularOffset = computed(() => (showPlainText.value ? 1 : 0))

const otherOffset = computed(() => popularOffset.value + filteredPopular.value.length)

// --- Copy ---
const isCopied = ref(false)

const copyCode = async () => {
  await copy(props.node.textContent)
  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
  }, 2000)
}

// --- Hover ---
const isHovered = ref(false)

const showToolbar = computed(() => isDropdownOpen.value || isHovered.value || props.selected)
</script>

<template>
  <NodeViewWrapper class="nc-code-block-wrapper" @mouseenter="isHovered = true" @mouseleave="isHovered = false">
    <!-- Toolbar: language selector + copy button -->
    <div v-show="showToolbar" class="nc-code-block-toolbar" contenteditable="false">
      <!-- Language selector -->
      <NcDropdown v-model:visible="isDropdownOpen" placement="bottomRight" overlay-class-name="nc-code-block-lang-dropdown">
        <button class="nc-code-block-lang-trigger" data-testid="nc-code-block-lang-selector">
          <span class="nc-code-block-lang-label">{{ currentLanguageLabel }}</span>
          <GeneralIcon icon="arrowDown" class="nc-code-block-lang-chevron" />
        </button>

        <template #overlay>
          <div
            class="nc-code-block-lang-list"
            @keydown.arrow-down.prevent="onArrowDown"
            @keydown.arrow-up.prevent="onArrowUp"
            @keydown.enter.prevent="onEnter"
          >
            <!-- Search input -->
            <div class="px-2 pt-2 pb-1">
              <a-input
                ref="searchInputRef"
                v-model:value="searchQuery"
                :placeholder="t('placeholder.searchLanguages')"
                class="nc-dropdown-search-unified-input"
                @change="activeIndex = 0"
              >
                <template #prefix>
                  <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1" />
                </template>
              </a-input>
            </div>

            <!-- Scrollable list -->
            <div class="nc-code-block-lang-scroll nc-scrollbar-thin">
              <!-- Plain text -->
              <button
                v-if="showPlainText"
                class="nc-code-block-lang-option"
                :class="{ 'nc-active': activeIndex === 0 }"
                @click="setLanguage(PLAIN_TEXT)"
              >
                <span>{{ $t('labels.plainText') }}</span>
                <GeneralIcon v-if="!currentLanguage" icon="check" class="nc-code-block-lang-check" />
              </button>

              <!-- Popular section -->
              <template v-if="filteredPopular.length">
                <div class="nc-code-block-lang-divider" />
                <button
                  v-for="(lang, i) in filteredPopular"
                  :key="lang.id"
                  class="nc-code-block-lang-option"
                  :class="{ 'nc-active': activeIndex === flatIndex(popularOffset, i) }"
                  @click="setLanguage(lang)"
                >
                  <span>{{ lang.label }}</span>
                  <GeneralIcon v-if="currentLanguage === lang.id" icon="check" class="nc-code-block-lang-check" />
                </button>
              </template>

              <!-- Other languages -->
              <template v-if="filteredOther.length">
                <div class="nc-code-block-lang-divider" />
                <button
                  v-for="(lang, i) in filteredOther"
                  :key="lang.id"
                  class="nc-code-block-lang-option"
                  :class="{ 'nc-active': activeIndex === flatIndex(otherOffset, i) }"
                  @click="setLanguage(lang)"
                >
                  <span>{{ lang.label }}</span>
                  <GeneralIcon v-if="currentLanguage === lang.id" icon="check" class="nc-code-block-lang-check" />
                </button>
              </template>

              <!-- No results -->
              <div
                v-if="!showPlainText && !filteredPopular.length && !filteredOther.length"
                class="px-3 py-4 text-center text-nc-content-gray-subtle text-bodySm"
              >
                {{ $t('title.noResultsMatchedYourSearch') }}
              </div>
            </div>
          </div>
        </template>
      </NcDropdown>

      <!-- Copy button -->
      <NcTooltip :title="isCopied ? $t('general.copied') : $t('labels.copyCode')" placement="top">
        <button class="nc-code-block-copy-btn" data-testid="nc-code-block-copy-btn" @click="copyCode">
          <GeneralIcon :icon="isCopied ? 'check' : 'copy'" />
        </button>
      </NcTooltip>
    </div>

    <!-- Code content — as="pre" is required by ProseMirror's code block node spec -->
    <NodeViewContent as="pre" class="nc-code-block-content" />
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.nc-code-block-wrapper {
  position: relative;
  margin: 0.75em 0;
}

.nc-code-block-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
}

.nc-code-block-lang-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
  }
}

.nc-code-block-lang-chevron {
  width: 12px;
  height: 12px;
  opacity: 0.6;
}

.nc-code-block-copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
  }
}

.nc-code-block-content {
  background-color: #1f2937;
  color: #f9fafb;
  border-radius: 0.5em;
  padding: 0.75em 1em;
  padding-top: 2.5em;
  overflow-x: auto;
  font-size: 0.875em;
  line-height: 1.6;

  // Global `* { font-family: Inter }` overrides inherited monospace on
  // every <span> inside the code block. Force monospace on all descendants.
  &,
  :deep(*) {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace !important;
  }

  :deep(code) {
    background: none;
    padding: 0;
    color: inherit;
    font-size: inherit;
  }
}
</style>

<!-- Language dropdown styles — unscoped since the overlay is teleported to body -->
<style lang="scss">
.nc-code-block-lang-dropdown {
  width: auto !important;
  min-width: 0 !important;
}

.nc-code-block-lang-list {
  width: 220px;
}

.nc-code-block-lang-scroll {
  max-height: min(360px, calc(100vh - 120px));
  overflow-y: auto;
  padding: 0 4px 4px;
}

.nc-code-block-lang-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--nc-content-gray);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;

  &:hover,
  &.nc-active {
    background: var(--nc-bg-gray-light);
  }
}

.nc-code-block-lang-check {
  width: 16px;
  height: 16px;
  color: var(--nc-content-brand);
  flex-shrink: 0;
}

.nc-code-block-lang-divider {
  height: 1px;
  margin: 4px 8px;
  background: var(--nc-border-gray-medium);
}
</style>
