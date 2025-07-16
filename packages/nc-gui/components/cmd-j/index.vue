<script setup lang="ts">
import { Client } from 'typesense'
import { useVModel } from '@vueuse/core'
import type { SortedResult } from '#imports'

const props = defineProps<{
  open: boolean
  setActiveCmdView: (cmd: CommandPaletteType) => void
}>()

const emits = defineEmits(['update:open'])

const vOpen = useVModel(props, 'open', emits)

const { user } = useGlobal()

const modalEl = ref<HTMLElement | null>(null)
const cmdInputEl = ref<HTMLElement | null>(null)
const selectedIndex = ref(0)

const typesenseClient = new Client({
  apiKey: 'lNKDTZdJrE76Sg8WEyeN9mXT29l1xq7Q',
  nodes: [
    {
      host: 'rqf5uvajyeczwt3xp-1.a1.typesense.net',
      port: 443,
      protocol: 'https',
    },
  ],
})

const { search, query } = useTypesenseSearch(typesenseClient, 'noco-docs-v2')

const hide = () => {
  vOpen.value = false
  search.value = ''
  selectedIndex.value = 0
}

const navigateToResult = (result: SortedResult) => {
  window.open(`https://nocodb.com${result.url}`, '_blank')
  hide()
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (!vOpen.value || !query.data?.value?.length) return

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, query.data.value.length - 1)
      break
    case 'ArrowUp':
      e.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
      break
    case 'Enter':
      e.preventDefault()
      if (query.data.value[selectedIndex.value]) {
        navigateToResult(query.data.value[selectedIndex.value])
      }
      break
  }

  document.querySelector(`.cmdj-action.selected`)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest',
  })
}

onClickOutside(modalEl, () => {
  hide()
})

useEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    hide()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    hide()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
    hide()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
    if (vOpen.value || !user?.value?.id) {
      hide()
      return
    }
    vOpen.value = true
    nextTick(() => {
      cmdInputEl.value?.focus()
    })
  } else {
    handleKeyDown(e)
  }
})

watch(vOpen, () => {
  if (vOpen.value) {
    nextTick(() => {
      cmdInputEl.value?.focus()
    })
  } else {
    selectedIndex.value = 0
  }
})
</script>

<template>
  <div v-if="vOpen" class="cmdk-modal cmdj-modal" :class="{ 'cmdk-modal-active cmdj-modal-active': vOpen }">
    <div ref="modalEl" class="cmdk-modal-content cmdj-modal-content relative h-[25.25rem]">
      <div class="cmdk-input-wrapper border-b-1 border-gray-200">
        <GeneralIcon class="h-4 w-4 text-gray-500" icon="search" />
        <input ref="cmdInputEl" v-model="search" class="cmdk-input cmdj-input" placeholder="Search through docs" type="text" />
      </div>

      <div class="cmdk-results-container overflow-y-auto max-h-80">
        <div v-if="!search?.length" class="flex flex-col p-4 gap-4 items-center justify-center text-sm">
          <img
            src="~assets/img/placeholder/no-search-result-found.png"
            class="!w-[240px] flex-none"
            alt="Search through our documentation"
          />
          <div>Search through our documentation</div>
        </div>
        <div
          v-else-if="(query.data.value === 'empty' || query.data.value?.length === 0) && !query.isLoading.value"
          class="flex flex-col p-4 items-start justify-center text-sm"
        >
          Your search did not match any results
        </div>

        <div v-else-if="!query.isLoading.value" class="cmdk-results">
          <template v-for="(result, index) in query.data.value" :key="result.id">
            <div
              class="cmdk-action cmdj-action"
              :class="{ 'selected': selectedIndex === index, 'pl-4': result.type !== 'page' }"
              @click="navigateToResult(result)"
              @mouseenter="selectedIndex = index"
            >
              <div class="cmdk-action-content">
                <div v-if="result.type === 'page'" class="pr-4">
                  <GeneralIcon icon="file" class="h-4 w-4" />
                </div>
                <div
                  :class="{
                    'pl-4': result.type !== 'page',
                  }"
                  class="cmdk-action-text flex-1"
                >
                  <div class="cmdk-action-title text-md">{{ result.content }}</div>
                </div>
              </div>
            </div>
          </template>
        </div>
        <div v-else class="flex flex-col p-4 gap-4 justify-center text-sm">
          <div>Searching...</div>
        </div>
      </div>

      <CmdFooter active-cmd="cmd-j" :set-active-cmd-view="setActiveCmdView" />
    </div>
  </div>
</template>

<style lang="scss">
/* TODO Move styles to Windi Classes */

:root {
  --cmdk-secondary-background-color: rgb(230, 230, 230);
  --cmdk-secondary-text-color: rgb(101, 105, 111);
  --cmdk-selected-background: rgb(245, 245, 245);

  --cmdk-icon-color: var(--cmdk-secondary-text-color);
  --cmdk-icon-size: 1.2em;

  --cmdk-modal-background: #fff;
}
.cmdk-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.5);
  z-index: 1100;

  color: rgb(60, 65, 73);
  font-size: 16px;

  .cmdk-action {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    outline: none;
    transition: all 0.1s ease;
    width: 100%;
    font-size: 0.9em;
    border-left: 4px solid transparent;
    cursor: pointer;

    &:hover,
    &.selected {
      cursor: pointer;
      background-color: rgb(248, 249, 251);
      border-left: 4px solid #3366ff;
      outline: none;
    }

    .cmdk-action-content {
      display: flex;
      align-items: center;
      flex-shrink: 0.01;
      flex-grow: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 0.75em 1em;
      width: 640px;
    }
  }
}
</style>
