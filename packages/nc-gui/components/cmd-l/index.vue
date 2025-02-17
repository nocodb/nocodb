<script setup lang="ts">
import { onKeyUp, useDebounceFn, useVModel } from '@vueuse/core'
import type { CommandPaletteType } from '~/lib/types'

const props = defineProps<{
  open: boolean
  setActiveCmdView: (cmd: CommandPaletteType) => void
}>()

const emits = defineEmits(['update:open'])

const vOpen = useVModel(props, 'open', emits)

const search = ref('')

const modalEl = ref<HTMLElement>()

const cmdInputEl = ref<HTMLInputElement>()

const { user } = useGlobal()

const viewStore = useViewsStore()

const { recentViews, activeView } = storeToRefs(viewStore)

const selected: Ref<string> = ref('')

const newView = ref<
  | {
      viewId: string | null
      tableId: string
      baseId: string
    }
  | undefined
>()

const filteredViews = computed(() => {
  if (!recentViews.value) return []
  const filtered = recentViews.value.filter((v) => {
    if (search.value === '') return true
    return v.viewName.toLowerCase().includes(search.value.toLowerCase())
  })
  if (filtered[0]) {
    selected.value = filtered[0]?.tableID + filtered[0]?.viewName
  }
  return filtered
})

const changeView = useDebounceFn(
  async ({ viewId, tableId, baseId }: { viewId: string | null; tableId: string; baseId: string }) => {
    await viewStore.changeView({ viewId, tableId, baseId })
    vOpen.value = false
  },
  200,
)

onKeyUp('Enter', async () => {
  if (vOpen.value && newView.value) {
    search.value = ''
    await changeView({ viewId: newView.value.viewId, tableId: newView.value.tableId, baseId: newView.value.baseId })
  }
})

function scrollToTarget() {
  const element = document.querySelector('.cmdk-action.selected')
  element?.scrollIntoView()
}

const moveUp = () => {
  if (!filteredViews.value.length) return
  const index = filteredViews.value.findIndex((v) => v.tableID + v.viewName === selected.value)
  if (index === 0) {
    selected.value =
      filteredViews.value[filteredViews.value.length - 1].tableID + filteredViews.value[filteredViews.value.length - 1].viewName

    const cmdOption = filteredViews.value[filteredViews.value.length - 1]
    newView.value = {
      viewId: cmdOption.viewId ?? null,
      tableId: cmdOption.tableID,
      baseId: cmdOption.baseId,
    }
    document.querySelector('.actions')?.scrollTo({ top: 99999, behavior: 'smooth' })
  } else {
    selected.value = filteredViews.value[index - 1].tableID + filteredViews.value[index - 1].viewName
    const cmdOption = filteredViews.value[index - 1]

    newView.value = {
      viewId: cmdOption.viewId ?? null,
      tableId: cmdOption.tableID,
      baseId: cmdOption.baseId,
    }
    nextTick(() => scrollToTarget())
  }
}

const moveDown = () => {
  if (!filteredViews.value.length) return
  const index = filteredViews.value.findIndex((v) => v.tableID + v.viewName === selected.value)
  if (index === filteredViews.value.length - 1) {
    selected.value = filteredViews.value[0].tableID + filteredViews.value[0].viewName

    const cmdOption = filteredViews.value[0]
    newView.value = {
      viewId: cmdOption.viewId ?? null,
      tableId: cmdOption.tableID,
      baseId: cmdOption.baseId,
    }
    document.querySelector('.actions')?.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    selected.value = filteredViews.value[index + 1].tableID + filteredViews.value[index + 1].viewName
    const cmdOption = filteredViews.value[index + 1]

    newView.value = {
      viewId: cmdOption.viewId ?? null,
      tableId: cmdOption.tableID,
      baseId: cmdOption.baseId,
    }
    nextTick(() => scrollToTarget())
  }
}

const hide = () => {
  vOpen.value = false
  search.value = ''
}

onClickOutside(modalEl, () => {
  hide()
})

useEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    hide()
  } else if (e.key === 'Enter') {
    if (newView.value && vOpen.value) {
      changeView({ viewId: newView.value.viewId, tableId: newView.value.tableId, baseId: newView.value.baseId })
    }
  } else if (e.key === 'ArrowUp') {
    if (!vOpen.value) return
    e.preventDefault()
    moveUp()
  } else if (e.key === 'ArrowDown') {
    if (!vOpen.value) return
    e.preventDefault()
    moveDown()
  } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
    if (!user.value) return
    if (!vOpen.value) {
      vOpen.value = true
    } else {
      moveUp()
    }
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
    if (!user.value) return
    if (!vOpen.value) {
      vOpen.value = true
    } else moveDown()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    hide()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
    hide()
  } else if (vOpen.value) {
    cmdInputEl.value?.focus()
  }
})

onMounted(() => {
  document.querySelector('.cmdOpt-list')?.focus()
  if (!activeView.value || !filteredViews.value.length) return
  const index = filteredViews.value.findIndex(
    (v) => v.viewName === activeView.value?.title && v.tableID === activeView.value?.fk_model_id,
  )
  if (index + 1 > filteredViews.value.length) {
    selected.value = filteredViews.value[0].tableID + filteredViews.value[0].viewName
  } else {
    if (!filteredViews.value[index + 1]) return
    selected.value = filteredViews.value[index + 1].tableID + filteredViews.value[index + 1].viewName
  }
})
</script>

<template>
  <div v-if="vOpen" class="cmdk-modal cmdl-modal" :class="{ 'cmdk-modal-active cmdl-modal-active': vOpen }">
    <div ref="modalEl" class="cmdk-modal-content cmdl-modal-content relative h-[25.25rem]">
      <div class="cmdk-input-wrapper border-b-1 border-gray-200">
        <GeneralIcon class="h-4 w-4 text-gray-500" icon="search" />
        <input ref="cmdInputEl" v-model="search" class="cmdk-input" placeholder="Search" type="text" />
      </div>
      <div class="flex items-center bg-white w-full z-[50]">
        <div class="text-sm px-4 py-2 text-gray-500">Recent Views</div>
      </div>
      <div class="flex flex-col shrink grow overflow-hidden shadow-[rgb(0_0_0_/_50%)_0px_16px_70px] max-w-[650px] p-0">
        <div class="scroll-smooth actions overflow-auto nc-scrollbar-md mb-10 relative mx-0 px-0 py-2">
          <div v-if="filteredViews.length < 1" class="flex flex-col p-4 items-start justify-center text-md">No recent views</div>
          <div v-else class="flex flex-col cmdOpt-list w-full">
            <div
              v-for="cmdOption of filteredViews"
              :key="cmdOption.tableID + cmdOption.viewName"
              v-e="['a:cmdL:changeView']"
              :class="{
                selected: selected === cmdOption.tableID + cmdOption.viewName,
              }"
              class="cmdk-action"
              @click="changeView({ viewId: cmdOption.viewId!, tableId: cmdOption.tableID, baseId: cmdOption.baseId })"
            >
              <div class="cmdk-action-content">
                <div class="flex w-1/2 items-center">
                  <div class="flex gap-2">
                    <GeneralViewIcon :meta="{ type: cmdOption.viewType }" class="mt-0.5 w-4 !min-h-4" />
                    <a-tooltip overlay-class-name="!px-2 !py-1 !rounded-lg">
                      <template #title>
                        {{ cmdOption.viewName }}
                      </template>
                      <span class="truncate max-w-56 capitalize">
                        {{ cmdOption.viewName }}
                      </span>
                    </a-tooltip>
                  </div>
                </div>
                <div class="flex w-1/2 justify-end text-gray-600">
                  <div class="flex gap-2 px-2 py-1 rounded-md items-center">
                    <component :is="iconMap.project" class="w-3 h-3" />
                    <a-tooltip overlay-class-name="!px-2 !py-1 !rounded-lg">
                      <template #title>
                        {{ cmdOption.baseName }}
                      </template>
                      <span class="max-w-32 text-xs truncate capitalize">
                        {{ cmdOption.baseName }}
                      </span>
                    </a-tooltip>
                    <span class="text-bold"> / </span>

                    <component :is="iconMap.table" class="w-3 h-3" />
                    <a-tooltip overlay-class-name="!px-2 !py-1 !rounded-lg">
                      <template #title>
                        {{ cmdOption.tableName }}
                      </template>
                      <span class="max-w-28 text-xs truncate capitalize">
                        {{ cmdOption.tableName }}
                      </span>
                    </a-tooltip>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <CmdFooter active-cmd="cmd-l" :set-active-cmd-view="setActiveCmdView" />
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
  z-index: 1000;

  color: rgb(60, 65, 73);
  font-size: 16px;

  .cmdk-action {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    outline: none;
    transition: color 0s ease 0s;
    width: 100%;
    font-size: 0.9em;
    border-left: 4px solid transparent;

    &.selected {
      cursor: pointer;
      background-color: rgb(248, 249, 251);
      border-left: 4px solid #36f;
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

    .cmdk-action-icon {
      margin-right: 0.4em;
    }
  }
}
</style>
