<script>
/** @typedef {import('./index').EntityMentionItem} EntityMentionItem */

const KIND_LABELS = {
  table: 'Tables',
  view: 'Views',
  automation: 'Automations',
  script: 'Scripts',
  document: 'Documents',
  user: 'Users',
  dashboard: 'Dashboards',
  interface: 'Interfaces',
  interfacePage: 'Interface Pages',
  integration: 'Integrations',
}

const KIND_ICONS = {
  table: 'table',
  view: 'grid',
  automation: 'ncAutomation',
  script: 'ncScript',
  document: 'ncFileText',
  user: 'ncUser',
  dashboard: 'dashboards',
  interface: 'ncLayers',
  interfacePage: 'ncFile',
  integration: 'integration',
}

export default {
  props: {
    /** @type {EntityMentionItem[]} */
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

  computed: {
    kindIcons() {
      return KIND_ICONS
    },

    /** Group headers rendered inline while keyboard nav stays on the flat list. */
    grouped() {
      const groups = []
      for (const [flatIndex, item] of this.items.entries()) {
        const last = groups[groups.length - 1]
        if (!last || last.kind !== item.kind) {
          groups.push({ kind: item.kind, label: KIND_LABELS[item.kind] ?? item.kind, items: [{ item, flatIndex }] })
        } else {
          last.items.push({ item, flatIndex })
        }
      }
      return groups
    },
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
        this.selectItem(this.selectedIndex)
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

    selectItem(index) {
      const item = this.items[index]

      if (item) {
        this.command({ id: item })
      }
    },
  },
}
</script>

<template>
  <div
    class="w-72 bg-nc-bg-default scroll-smooth nc-mention-list nc-scrollbar-thin border-1 border-nc-border-gray-medium rounded-lg max-h-64 overflow-y-auto !py-1.5 px-1.5 shadow-lg"
    @mousedown.stop
  >
    <template v-if="items.length">
      <template v-for="group in grouped" :key="group.kind">
        <div class="px-2.5 pt-2 pb-1 text-captionSm text-nc-content-gray-muted uppercase tracking-wide">{{ group.label }}</div>
        <div
          v-for="{ item, flatIndex } in group.items"
          :key="`${item.kind}-${item.refId}`"
          :class="{ 'is-selected': flatIndex === selectedIndex }"
          class="py-1.5 px-2.5 flex hover:bg-nc-bg-gray-light rounded-md transition-all cursor-pointer items-center gap-2 text-nc-content-gray"
          @click="selectItem(flatIndex)"
        >
          <GeneralIntegrationIcon v-if="item.kind === 'integration' && item.subType" :type="item.subType" size="sx" />
          <GeneralIcon v-else :icon="kindIcons[item.kind] ?? 'file'" class="flex-none w-3.5 h-3.5 text-nc-content-gray-subtle2" />
          <NcTooltip class="truncate text-bodySm" show-on-truncate-only :tooltip-style="{ zIndex: '10000' }">
            <template #title>
              {{ item.title }}
            </template>
            {{ item.title }}
          </NcTooltip>
          <span v-if="item.hint" class="flex-none max-w-24 truncate text-captionSm text-nc-content-gray-muted">
            {{ item.hint }}
          </span>
        </div>
      </template>
    </template>
    <div v-else class="px-2.5 py-1.5 text-bodySm text-nc-content-gray-muted">Nothing to mention</div>
  </div>
</template>

<style lang="scss" scoped>
.is-selected {
  @apply bg-nc-bg-gray-light;
}
</style>
