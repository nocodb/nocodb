<script setup lang="ts">
import { onKeyUp, useDebounceFn, useMagicKeys, useVModel, whenever } from '@vueuse/core'
import { onClickOutside } from '#imports'

const props = defineProps<{
  open: boolean
}>()

const emits = defineEmits(['update:open'])

const vOpen = useVModel(props, 'open', emits)

const modalEl = ref<HTMLElement>()

const { user } = useGlobal()

const viewStore = useViewsStore()

const { recentViews, activeView } = storeToRefs(viewStore)

const selected: Ref<string> = ref('')

const newView: Ref<
  | {
      viewId: string | null
      tableId: string
      baseId: string
    }
  | undefined
> = ref()

const changeView = useDebounceFn(
  async ({ viewId, tableId, baseId }: { viewId: string | null; tableId: string; baseId: string }) => {
    await viewStore.changeView({ viewId, tableId, baseId })
    vOpen.value = false
  },
  200,
)

const keys = useMagicKeys()

const { current } = keys

onKeyUp('Enter', async () => {
  if (vOpen.value && newView.value) {
    await changeView({ viewId: newView.value.viewId, tableId: newView.value.tableId, baseId: newView.value.baseId })
  }
})

function scrollToTarget() {
  const element = document.querySelector('.cmdk-action.selected')
  const headerOffset = 45
  const elementPosition = element?.getBoundingClientRect().top
  const offsetPosition = elementPosition! + window.pageYOffset - headerOffset

  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth',
  })
}

const renderCmdOrCtrlKey = () => {
  return isMac() ? '⌘' : 'Ctrl'
}

const moveUp = () => {
  if (!recentViews.value.length) return
  const index = recentViews.value.findIndex((v) => v.tableID + v.viewName === selected.value)
  if (index === 0) {
    selected.value =
      recentViews.value[recentViews.value.length - 1].tableID + recentViews.value[recentViews.value.length - 1].viewName

    const cmdOption = recentViews.value[recentViews.value.length - 1]
    newView.value = {
      viewId: cmdOption.viewId ?? null,
      tableId: cmdOption.tableID,
      baseId: cmdOption.baseId,
    }
    document.querySelector('.actions')?.scrollTo({ top: 99999, behavior: 'smooth' })
  } else {
    selected.value = recentViews.value[index - 1].tableID + recentViews.value[index - 1].viewName
    const cmdOption = recentViews.value[index - 1]
    scrollToTarget()

    newView.value = {
      viewId: cmdOption.viewId ?? null,
      tableId: cmdOption.tableID,
      baseId: cmdOption.baseId,
    }
  }
}

const moveDown = () => {
  if (!recentViews.value.length) return
  const index = recentViews.value.findIndex((v) => v.tableID + v.viewName === selected.value)
  if (index === recentViews.value.length - 1) {
    selected.value = recentViews.value[0].tableID + recentViews.value[0].viewName

    const cmdOption = recentViews.value[0]
    newView.value = {
      viewId: cmdOption.viewId ?? null,
      tableId: cmdOption.tableID,
      baseId: cmdOption.baseId,
    }
    document.querySelector('.actions')?.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    selected.value = recentViews.value[index + 1].tableID + recentViews.value[index + 1].viewName
    const cmdOption = recentViews.value[index + 1]

    scrollToTarget()

    newView.value = {
      viewId: cmdOption.viewId ?? null,
      tableId: cmdOption.tableID,
      baseId: cmdOption.baseId,
    }
  }
}

whenever(keys['Ctrl+Shift+L'], async () => {
  if (!user.value) return
  vOpen.value = true
  moveUp()
})

whenever(keys['Meta+Shift+L'], async () => {
  if (!user.value) return
  vOpen.value = true
  moveUp()
})

whenever(keys.ctrl_l, async () => {
  if (!user.value) return
  if (current.has('shift')) return
  vOpen.value = true
  moveDown()
})

whenever(keys.meta_l, async () => {
  if (!user.value) return
  if (current.has('shift')) return
  vOpen.value = true
  moveDown()
})

whenever(keys.arrowup, () => {
  if (vOpen.value) moveUp()
})

whenever(keys.arrowdown, () => {
  if (vOpen.value) moveDown()
})

const hide = () => {
  vOpen.value = false
}

whenever(keys.Escape, () => {
  if (vOpen.value) hide()
})

whenever(keys.ctrl_k, () => {
  if (vOpen.value) hide()
})

whenever(keys.meta_k, () => {
  if (vOpen.value) hide()
})

whenever(keys.ctrl_j, () => {
  if (vOpen.value) hide()
})

whenever(keys.meta_j, () => {
  if (vOpen.value) hide()
})

onClickOutside(modalEl, () => {
  if (vOpen.value) hide()
})

onMounted(() => {
  document.querySelector('.cmdOpt-list')?.focus()
  if (!activeView.value) return
  const index = recentViews.value.findIndex(
    (v) => v.viewName === activeView?.value.name && v.tableID === activeView?.value.tableId,
  )
  if (index + 1 > recentViews.value.length) {
    selected.value = recentViews.value[0].tableID + recentViews.value[0].viewName
  } else {
    selected.value = recentViews.value[index + 1].tableID + recentViews.value[index + 1].viewName
  }
})
</script>

<template>
  <div v-if="vOpen" class="cmdk-modal cmdl-modal" :class="{ 'cmdk-modal-active cmdl-modal-active': vOpen }">
    <div ref="modalEl" class="cmdk-modal-content cmdl-modal-content relative h-[25.25rem]">
      <div class="flex items-center bg-white w-full z-[50]">
        <div class="text-sm p-4 text-gray-500">Recent Views</div>
      </div>
      <div class="flex flex-col shrink grow overflow-hidden shadow-[rgb(0_0_0_/_50%)_0px_16px_70px] max-w-[650px] p-0">
        <div class="scroll-smooth actions overflow-auto nc-scrollbar-md relative m-0 px-0 py-2">
          <div v-if="recentViews.length < 1" class="flex flex-col p-4 items-start justify-center text-md">No recent views</div>
          <div v-else class="flex mb-10 flex-col cmdOpt-list w-full">
            <div
              v-for="cmdOption of recentViews"
              :key="cmdOption.tableID + cmdOption.viewName"
              v-e="['a:cmdL:changeView']"
              :class="{
                selected: selected === cmdOption.tableID + cmdOption.viewName,
              }"
              class="cmdk-action"
              @click="changeView({ viewId: cmdOption.viewId, tableId: cmdOption.tableID, baseId: cmdOption.baseId })"
            >
              <div class="cmdk-action-content !flex w-full">
                <div class="flex gap-2 w-full flex-grow-1 items-center">
                  <GeneralViewIcon :meta="{ type: cmdOption.viewType }" />
                  <a-tooltip overlay-class-name="!px-2 !py-1 !rounded-lg">
                    <template #title>
                      {{ cmdOption.viewName }}
                    </template>
                    <span class="max-w- truncate capitalize">
                      {{ cmdOption.viewName }}
                    </span>
                  </a-tooltip>
                </div>
                <div class="flex gap-2 bg-gray-100 px-2 py-1 rounded-md text-gray-600 items-center">
                  <component :is="iconMap.project" class="w-4 h-4 text-transparent" />
                  <a-tooltip overlay-class-name="!px-2 !py-1 !rounded-lg">
                    <template #title>
                      {{ cmdOption.baseName }}
                    </template>
                    <span class="max-w-32 truncate capitalize">
                      {{ cmdOption.baseName }}
                    </span>
                  </a-tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="cmdk-footer absolute !bg-white inset-x-0 bottom-0">
        <div class="flex justify-center w-full py-2">
          <div class="flex flex-grow-1 w-full text-sm items-center gap-2 justify-center">
            <MdiFileOutline class="h-4 w-4" />
            Document
            <span class="bg-gray-100 px-1 rounded-md border-1 border-gray-300"> {{ renderCmdOrCtrlKey() }} + J </span>
          </div>
          <div class="flex flex-grow-1 w-full text-sm items-center gap-2 justify-center">
            <MdiMapMarkerOutline class="h-4 w-4" />
            Quick Navigation
            <span class="bg-gray-100 px-1 rounded-md border-1 border-gray-300"> {{ renderCmdOrCtrlKey() }} + K </span>
          </div>
          <div class="flex flex-grow-1 text-brand-500 w-full text-sm items-center gap-2 justify-center">
            <MdiClockOutline class="h-4 w-4" />
            Recent
            <span class="bg-brand-500 text-white px-1 rounded-md border-1 border-brand-500">
              {{ renderCmdOrCtrlKey() }} + L
            </span>
          </div>
        </div>
      </div>
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
