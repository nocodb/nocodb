<script>
export default {
  props: {
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
          id: item,
        })
      }
    },
  },
}
</script>

<template>
  <div class="w-64 bg-white scroll-smooth nc-mention-list nc-scrollbar-md border-1 border-gray-200 rounded-lg max-h-64 !py-2">
    <template v-if="items.length">
      <div
        v-for="(item, index) in items"
        :key="index"
        :class="{ 'is-selected': index === selectedIndex }"
        class="py-2 flex hover:bg-gray-100 transition-all cursor-pointer items-center text-gray-800 pl-4"
        @click="selectItem(index, $event)"
      >
        {{ item }}
      </div>
    </template>
    <div v-else class="px-4">No field available</div>
  </div>
</template>

<style lang="scss" scoped>
.is-selected {
  @apply bg-gray-100;
}
</style>
