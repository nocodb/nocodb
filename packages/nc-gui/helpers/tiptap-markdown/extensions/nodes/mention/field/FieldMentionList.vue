<script>
/** @typedef {import('nocodb-sdk').ColumnType} ColumnType */

export default {
  props: {
    /** @type {ColumnType[]} */
    items: {
      type: Array,
      required: true,
    },

    command: {
      type: Function,
      required: true,
    },

    /** Text typed after the trigger character in the editor. */
    query: {
      type: String,
      default: '',
    },

    editor: {
      type: Object,
      default: null,
    },

    /** Editor range of the trigger + query, removed when the mention is cancelled. */
    range: {
      type: Object,
      default: null,
    },
  },

  data() {
    return {
      selectedIndex: 0,
      search: this.query ?? '',
    }
  },

  computed: {
    // `items` already reflects what was typed in the editor; the search box narrows further
    filteredItems() {
      const term = (this.search ?? '').trim().toLowerCase()
      if (!term) return this.items

      return this.items.filter((item) => item?.title?.toLowerCase().includes(term))
    },
  },

  watch: {
    filteredItems() {
      this.selectedIndex = 0
    },
    // tiptap's renderer doesn't always send `query` on an update
    query(value) {
      this.search = value ?? ''
    },
    selectedIndex() {
      nextTick(() => {
        this.scrollToSelected()
      })
    },
  },

  mounted() {
    // Typing continues in the search box, as soon as the list opens
    nextTick(() => {
      this.$refs.searchInput?.focus()
    })
  },

  methods: {
    // Keys pressed while focus is still in the editor (forwarded by the suggestion plugin)
    onKeyDown({ event }) {
      return this.handleNavigationKey(event)
    },

    // Keys pressed in the search box
    onSearchKeyDown(event) {
      if (event.key === 'Escape' || (event.key === 'Backspace' && !this.search)) {
        event.preventDefault()
        event.stopPropagation()
        this.cancel()
        return
      }

      if (this.handleNavigationKey(event)) {
        event.preventDefault()
        event.stopPropagation()
      }
    },

    handleNavigationKey(event) {
      if (event.key === 'ArrowUp') {
        this.upHandler()
        return true
      }

      if (event.key === 'ArrowDown') {
        this.downHandler()
        return true
      }

      if (event.key === 'Enter') {
        event.stopPropagation()
        this.selectItem(this.selectedIndex)
        return true
      }

      if (event.key === 'Tab') {
        this.selectItem(this.selectedIndex)
        return true
      }

      // `{Field}` prompts: a closing brace picks the highlighted field
      if (event.key === '}') {
        setTimeout(() => {
          this.selectItem(this.selectedIndex)
        }, 250)
      }

      return false
    },

    /** Drop the trigger character (and anything typed after it) and hand focus back to the editor. */
    cancel() {
      if (this.editor && this.range) {
        this.editor.chain().focus().deleteRange(this.range).run()
      } else {
        this.editor?.commands.focus()
      }
    },

    scrollToSelected() {
      const selectedElement = this.$el.querySelector('.is-selected')
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    },

    upHandler() {
      if (!this.filteredItems.length) return
      this.selectedIndex = (this.selectedIndex + this.filteredItems.length - 1) % this.filteredItems.length
    },

    downHandler() {
      if (!this.filteredItems.length) return
      this.selectedIndex = (this.selectedIndex + 1) % this.filteredItems.length
    },

    selectItem(index) {
      const item = this.filteredItems[index]

      if (item) {
        this.command({
          id: item.title,
        })
      }
    },
  },
}
</script>

<template>
  <div class="nc-mention-list" @mousedown.stop>
    <input
      ref="searchInput"
      v-model="search"
      class="nc-mention-list-search"
      :placeholder="$t('placeholder.searchFields')"
      data-testid="nc-mention-list-search"
      @keydown="onSearchKeyDown"
    />

    <div class="nc-mention-list-items nc-scrollbar-thin">
      <template v-if="filteredItems.length">
        <div
          v-for="(item, index) in filteredItems"
          :key="item?.id ?? index"
          :class="{ 'is-selected': index === selectedIndex }"
          class="nc-mention-list-item"
          @mouseenter="selectedIndex = index"
          @click="selectItem(index)"
        >
          <SmartsheetHeaderIcon
            v-if="item?.uidt"
            :column="item"
            class="flex-none !w-3.5 !h-3.5 !mx-0"
            color="text-nc-content-gray-muted"
          />
          <NcTooltip class="truncate" show-on-truncate-only :tooltip-style="{ zIndex: '10000' }">
            <template #title>
              {{ item?.title || '' }}
            </template>
            {{ item?.title || '' }}
          </NcTooltip>
        </div>
      </template>
      <div v-else class="px-3 py-2 text-sm text-nc-content-gray-muted">{{ $t('title.noFieldsFound') }}</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-mention-list {
  @apply w-72 flex flex-col overflow-hidden rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default shadow-lg;
}

.nc-mention-list-search {
  @apply w-full h-10 px-3 text-sm text-nc-content-gray bg-nc-bg-gray-extralight border-0 border-b-1 border-nc-border-gray-light outline-none;

  &::placeholder {
    @apply text-nc-content-gray-muted;
  }
}

.nc-mention-list-items {
  @apply flex flex-col gap-0.5 p-1.5 max-h-64 overflow-y-auto;
  scroll-behavior: smooth;
}

.nc-mention-list-item {
  // flex-none: in the height-capped, scrolling list, rows would otherwise shrink to their text height
  @apply flex flex-none items-center gap-2.5 h-8 px-2.5 rounded-md cursor-pointer text-sm text-nc-content-gray transition-colors;

  &.is-selected {
    @apply bg-nc-bg-gray-light;
  }
}
</style>
