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
  },

  data() {
    return {
      selectedIndex: 0,
    }
  },

  watch: {
    items() {
      this.selectedIndex = 0
    },
    selectedIndex() {
      nextTick(() => {
        this.scrollToSelected()
      })
    },
  },

  created() {},

  methods: {
    onKeyDown({ event }) {
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
        this.enterHandler(event)
        return true
      }

      if (event.key === 'Tab') {
        this.selectItem(this.selectedIndex)
        return true
      }

      if (event.key === '}') {
        setTimeout(() => {
          this.selectItem(this.selectedIndex)
        }, 250)
      }

      return false
    },

    scrollToSelected() {
      const selectedElement = this.$el.querySelector('.is-selected')
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    },

    upHandler() {
      this.selectedIndex = (this.selectedIndex + this.items.length - 1) % this.items.length
    },

    downHandler() {
      this.selectedIndex = (this.selectedIndex + 1) % this.items.length
    },

    enterHandler(e) {
      this.selectItem(this.selectedIndex, e)
    },

    selectItem(index, _e) {
      const item = this.items[index]

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
  <div
    class="w-64 bg-nc-bg-default scroll-smooth nc-mention-list nc-scrollbar-thin border-1 border-nc-border-gray-medium rounded-lg max-h-64 !py-2 px-2 shadow-lg"
    @mousedown.stop
  >
    <template v-if="items.length">
      <div
        v-for="(item, index) in items"
        :key="index"
        :class="{ 'is-selected': index === selectedIndex }"
        class="py-2 flex hover:bg-nc-bg-gray-light rounded-md transition-all cursor-pointer items-center gap-2 text-nc-content-gray pl-4"
        @click="selectItem(index, $event)"
      >
        <SmartsheetHeaderIcon
          v-if="item?.uidt"
          :column="item"
          class="flex-none w-3.5 h-3.5"
          color="text-nc-content-gray-subtle2"
        />
        <NcTooltip class="truncate" show-on-truncate-only :tooltip-style="{ zIndex: '10000' }">
          <template #title>
            {{ item?.title || '' }}
          </template>
          {{ item?.title || '' }}
        </NcTooltip>
      </div>
    </template>
    <div v-else class="px-4">No field available</div>
  </div>
</template>

<style lang="scss" scoped>
.is-selected {
  @apply bg-nc-bg-gray-light;
}
</style>
