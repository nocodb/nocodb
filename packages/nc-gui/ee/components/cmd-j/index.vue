<script setup lang="ts">
const props = defineProps<{
  open: boolean
}>()
const emits = defineEmits(['update:open'])

const nuxtApp = useNuxtApp()

const keys = useMagicKeys()

const vOpen = useVModel(props, 'open', emits)

const modalEl = ref<HTMLElement>()

const selected = ref(0)

const visit = (url: string) => {
  window.location.href = url
  vOpen.value = false
}

whenever(keys.ArrowDown, () => {
  if (!vOpen.value) return
  selected.value = Math.min(selected.value + 1, document.querySelectorAll('.cmdj-action').length - 1)
  document.querySelector('.cmdj-action.selected')?.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'start',
  })
})

whenever(keys.ArrowUp, () => {
  if (!vOpen.value) return
  if (selected.value !== 0) {
    selected.value = Math.max(selected.value - 1, 0)
  } else {
    selected.value = document.querySelectorAll('.cmdj-action').length - 1
  }
  document.querySelector('.cmdj-action.selected')?.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'start',
  })
})

const hide = () => {
  if (!vOpen.value) return
  vOpen.value = false
}

whenever(keys.ctrl_j, () => {
  vOpen.value = true
})

whenever(keys.meta_j, () => {
  vOpen.value = true
})

whenever(keys.ctrl_k, () => {
  if (vOpen.value) hide()
})

whenever(keys.meta_k, () => {
  if (vOpen.value) hide()
})

whenever(keys.ctrl_l, () => {
  if (vOpen.value) hide()
})

whenever(keys.meta_l, () => {
  if (vOpen.value) hide()
})

whenever(keys.Escape, () => {
  hide()
})

onClickOutside(modalEl, () => {
  hide()
})

const focus: VNodeRef = (el: HTMLInputElement) => el?.focus()

const searchClient = nuxtApp.$typesenseInstantsearchAdapter.searchClient
</script>

<template>
  <div v-if="vOpen" class="cmdj-modal" :class="{ 'cmdj-modal-active': vOpen }">
    <div ref="modalEl" class="cmdj-modal-content">
      <ais-instant-search :search-client="searchClient" index-name="nocodb-oss-docs-index">
        <div class="cmdj-header">
          <div class="cmdj-input-wrapper">
            <ais-search-box v-slot="{ currentRefinement, refine }">
              <span>
                <MdiMagnify class="h-6 w-6" />
              </span>
              <input
                :ref="focus"
                class="cmdj-input"
                placeholder="Search Docs"
                type="search"
                :value="currentRefinement"
                @input="
                  (event) => {
                    refine(event.target.value)
                    selected = 0
                  }
                "
              />
            </ais-search-box>
          </div>
        </div>
        <div class="cmdj-body">
          <ais-hits v-slot="{ items }" class="cmdj-actions">
            <div
              v-for="(item, index) in items.filter((i) => i.content)"
              :key="index"
              class="cmdj-action cursor-pointer"
              :class="{ selected: index === selected }"
              @click="visit(item.url)"
              @enter="visit(item.url)"
            >
              <span class="cmdj-action-icon">
                <MdiFileOutline class="h-4 w-4" />
              </span>
              <span class="cmdj-action-title">{{ item.content }}</span>
            </div>
          </ais-hits>
        </div>
        <div class="cmdj-footer">
          <div class="flex justify-center w-full py-2">
            <div class="flex flex-grow-1 w-full text-brand-500 text-sm items-center gap-2 justify-center">
              <MdiFileOutline class="h-4 w-4" />
              Document
              <span class="bg-gray-100 px-1 rounded-md border-1 border-gray-300"> {{ isMac() ? '⌘' : 'Ctrl' }} J </span>
            </div>
            <div class="flex flex-grow-1 w-full text-sm items-center gap-2 justify-center">
              <MdiMapMarkerOutline class="h-4 w-4" />
              Quick Navigation
              <span class="bg-gray-100 px-1 rounded-md border-1 border-gray-300"> {{ isMac() ? '⌘' : 'Ctrl' }} K </span>
            </div>
            <div class="flex flex-grow-1 w-full text-sm items-center gap-2 justify-center">
              <MdiClockOutline class="h-4 w-4" />
              Recent
              <span class="bg-gray-100 px-1 rounded-md border-1 border-gray-300"> {{ isMac() ? '⌘' : 'Ctrl' }} L </span>
            </div>
          </div>
        </div>
      </ais-instant-search>
    </div>
  </div>
</template>

<style>
:root {
  --cmdj-secondary-background-color: rgb(230, 230, 230);
  --cmdj-secondary-text-color: rgb(101, 105, 111);
  --cmdj-selected-background: rgb(245, 245, 245);

  --cmdj-icon-color: var(--cmdj-secondary-text-color);
  --cmdj-icon-size: 1.2em;

  --cmdj-modal-background: #fff;
}
.cmdj-modal {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.5);
  z-index: 1000;

  color: rgb(60, 65, 73);
  font-size: 16px;

  .cmdj-modal-content {
    position: relative;
    display: flex;
    flex-direction: column;
    flex-shrink: 1;
    -webkit-box-flex: 1;
    flex-grow: 1;
    padding: 0;
    overflow: hidden;
    margin: auto;
    box-shadow: rgb(0 0 0 / 50%) 0px 16px 70px;
    top: 20%;
    border-radius: 0.5em;
    max-width: 600px;
    background: var(--cmdj-modal-background);
  }

  .cmdj-input-wrapper {
    padding-inline: 1.25em;

    display: flex;
    border-bottom: 1px solid rgb(230, 230, 230);
  }

  .cmdj-input {
    flex-grow: 1;
    flex-shrink: 0;
    margin: 0px;
    border: none;
    appearance: none;
    font-size: 1.125em;
    background: transparent;
    outline: none;
    box-shadow: var(--tw-ring-inset) 0 0 0 calc(0px + var(--tw-ring-offset-width)) var(--tw-ring-color) !important;

    caret-color: pink;
    color: rgb(60, 65, 73);
  }

  .cmdj-input::placeholder {
    color: rgb(165, 165, 165);
    opacity: 1;
  }

  .cmdj-input:-ms-input-placeholder {
    color: rgb(165, 165, 165);
  }

  .cmdj-input::-ms-input-placeholder {
    color: rgb(165, 165, 165);
  }

  .cmdj-actions {
    max-height: 235px;
    margin: 0px;
    padding: 0.5em 0px;
    list-style: none;
    scroll-behavior: smooth;
    overflow: hidden;
    position: relative;

    --scrollbar-track: initial;
    --scrollbar-thumb: initial;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
    overflow: overlay;
    scrollbar-width: auto;
    scrollbar-width: thin;
    --scrollbar-thumb: #e1e3e6;
    --scrollbar-track: #fff;

    .cmdj-action {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      outline: none;
      padding: 0.5em;
      transition: color 0s ease 0s;
      width: 100%;
      font-size: 0.9em;
      border-left: 2px solid transparent;

      &.selected {
        cursor: pointer;
        background-color: rgb(248, 249, 251);
        border-left: 2px solid var(--ant-primary-color);
        outline: none;
      }

      .cmdj-action-content {
        display: flex;
        align-items: center;
        flex-shrink: 0.01;
        flex-grow: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding: 0.75em 1em;
        width: 100%;
      }

      .cmdj-action-icon {
        margin-right: 0.4em;
      }
    }

    .cmdj-action-section {
      display: flex;
      flex-direction: column;
      width: 100%;

      .cmdj-action-section-header {
        display: flex;
        align-items: center;
        padding: 0.2em 1em;
        font-size: 0.8em;
        color: rgb(144, 149, 157);
      }
    }
  }
}
</style>
