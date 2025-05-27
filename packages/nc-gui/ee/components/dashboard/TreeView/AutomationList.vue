<script setup lang="ts">
import Sortable from 'sortablejs'
import { type SortableEvent } from 'sortablejs'
import { type ScriptType } from 'nocodb-sdk'
import type { Menu as AntMenu } from 'ant-design-vue/lib/components'

const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { $e, $api } = useNuxtApp()

const { t } = useI18n()

const { addUndo, defineModelScope } = useUndoRedo()

const { ncNavigateTo, isMobileMode } = useGlobal()

const { isNewSidebarEnabled } = storeToRefs(useSidebarStore())

const bases = useBases()

const { isUIAllowed } = useRoles()

const { isSharedBase } = storeToRefs(useBase())

const { openedProject, baseHomeSearchQuery } = storeToRefs(bases)

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const automationStore = useAutomationStore()

const { updateAutomation, openNewScriptModal } = automationStore

const { activeAutomationId, automations } = storeToRefs(automationStore)

const scripts = computed(() => automations.value.get(baseId.value) ?? [])

let sortable: Sortable

const selected = ref<string[]>([])

const dragging = ref(false)

function onSortStart(evt: SortableEvent) {
  evt.stopImmediatePropagation()
  evt.preventDefault()
  dragging.value = true
}
async function onSortEnd(evt: SortableEvent, undo = false) {
  if (!undo) {
    evt.stopImmediatePropagation()
    evt.preventDefault()
    dragging.value = false
  }

  if (scripts.value.length < 2) return

  let { newIndex = 0, oldIndex = 0 } = evt

  newIndex = newIndex - 1
  oldIndex = oldIndex - 1

  if (newIndex === oldIndex) return

  if (!undo) {
    addUndo({
      redo: {
        fn: async () => {
          const ord = sortable.toArray()
          const temp = ord.splice(oldIndex, 1)
          ord.splice(newIndex, 0, temp[0])
          sortable.sort(ord)
          await onSortEnd(evt, true)
        },
        args: [],
      },
      undo: {
        fn: async () => {
          const ord = sortable.toArray()
          const temp = ord.splice(newIndex, 1)
          ord.splice(oldIndex, 0, temp[0])
          sortable.sort(ord)
          await onSortEnd({ ...evt, oldIndex: newIndex, newIndex: oldIndex }, true)
        },
        args: [],
      },
      scope: defineModelScope({ view: activeAutomationId.value }),
    })
  }

  const children = Array.from(evt.to.children as unknown as HTMLLIElement[])

  // remove `Create View` children from list
  children.shift()

  const previousEl = children[newIndex - 1]
  const nextEl = children[newIndex + 1]

  const currentItem = scripts.value.find((v) => v.id === evt.item.id)

  if (!currentItem || !currentItem.id) return

  // set default order value as 0 if item not found
  const previousItem = (
    previousEl ? scripts.value.find((v) => v.id === previousEl.id) ?? { order: 0 } : { order: 0 }
  ) as ScriptType
  const nextItem = (nextEl ? scripts.value.find((v) => v.id === nextEl.id) : {}) as ScriptType

  let nextOrder: number

  // set new order value based on the new order of the items
  if (scripts.value.length - 1 === newIndex) {
    nextOrder = parseFloat(String(previousItem.order)) + 1
  } else if (newIndex === 0) {
    nextOrder = parseFloat(String(nextItem.order)) / 2
  } else {
    nextOrder = (parseFloat(String(previousItem.order)) + parseFloat(String(nextItem.order))) / 2
  }

  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

  currentItem.order = _nextOrder

  await $api.script.update(baseId.value, currentItem.id, { order: _nextOrder })

  markItem(currentItem.id)

  $e('a:script:reorder')
}

async function changeScript(script: ScriptType) {
  ncNavigateTo({
    workspaceId: activeWorkspaceId.value,
    automation: true,
    baseId: baseId.value,
    automationId: script.id,
  })
}

const isMarked = ref<string | false>(false)

/** shortly mark an item after sorting */
function markItem(id: string) {
  isMarked.value = id
  setTimeout(() => {
    isMarked.value = false
  }, 300)
}

/** validate script title */
function validate(script: ScriptType) {
  if (!script.title || script.title.trim().length < 0) {
    return t('msg.error.scriptNameRequired')
  }

  if (scripts.value.some((s) => s.title === script.title && s.id !== script.id)) {
    return t('msg.error.scriptNameDuplicate')
  }

  return true
}

async function onRename(script: ScriptType, originalTitle?: string, undo = false) {
  try {
    await updateAutomation(script.base_id, script.id as string, {
      title: script.title,
      order: script.order,
    })

    if (!undo) {
      addUndo({
        redo: {
          fn: (s: ScriptType, title: string) => {
            const tempTitle = s.title
            s.title = title
            onRename(s, tempTitle, true)
          },
          args: [script, script.title],
        },
        undo: {
          fn: (s: ScriptType, title: string) => {
            const tempTitle = s.title
            s.title = title
            onRename(s, tempTitle, true)
          },
          args: [script, originalTitle],
        },
        scope: defineModelScope({ base_id: script.base_id }),
      })
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Open delete modal */
function openDeleteDialog(script: ScriptType) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgAutomationDelete'), {
    'modelValue': isOpen,
    'script': script,
    'onUpdate:modelValue': closeDialog,
    'onDeleted': async () => {
      closeDialog()
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const menuRef = ref<typeof AntMenu>()

const initSortable = (el: HTMLElement) => {
  if (sortable) sortable.destroy()
  if (isMobileMode.value) return

  sortable = new Sortable(el, {
    // handle: '.nc-drag-icon',
    ghostClass: 'ghost',
    onStart: onSortStart,
    onEnd: onSortEnd,
  })
}

onMounted(() => {
  if (isUIAllowed('scriptCreateOrEdit') && menuRef.value) {
    initSortable(menuRef.value.$el)
  }
})

const filteredScripts = computed(() => {
  return scripts.value.filter((script) => searchCompare(script.title, baseHomeSearchQuery.value))
})
</script>

<template>
  <a-menu
    ref="menuRef"
    :class="{ dragging }"
    :selected-keys="selected"
    class="nc-scripts-menu flex flex-col w-full !border-r-0 !bg-inherit"
  >
    <div
      v-if="!scripts?.length || !filteredScripts.length"
      class="nc-project-home-section-item text-gray-500 font-normal"
      :class="{
        'ml-11.5 xs:(ml-12.25) ': !isNewSidebarEnabled,
      }"
    >
      {{
        scripts?.length && !filteredScripts.length
          ? $t('placeholder.noResultsFoundForYourSearch')
          : $t('placeholder.noAutomations')
      }}
    </div>

    <template v-if="(!isNewSidebarEnabled || !scripts?.length) && !isSharedBase && isUIAllowed('scriptCreateOrEdit')">
      <div
        :class="{
          '!pl-13.3 !xs:(pl-13.5)': !isNewSidebarEnabled,
        }"
        @click="openNewScriptModal({ baseId })"
      >
        <div
          :class="{
            'text-brand-500 hover:text-brand-600': openedProject?.id === baseId,
            'text-gray-500 hover:text-brand-500': openedProject?.id !== baseId,
          }"
          class="nc-create-script-btn flex flex-row items-center cursor-pointer rounded-md w-full"
          role="button"
        >
          <div
            :class="{
              'nc-project-home-section-item': isNewSidebarEnabled,
              'flex flex-row items-center pl-1.25 !py-1.5 text-inherit': !isNewSidebarEnabled,
            }"
          >
            <GeneralIcon icon="plus" />
            <div :class="{ 'pl-1.75': !isNewSidebarEnabled }">
              {{
                $t('general.createEntity', {
                  entity: $t('objects.script'),
                })
              }}
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-if="filteredScripts?.length">
      <DashboardTreeViewAutomationNode
        v-for="script of filteredScripts"
        :id="script.id"
        :key="script.id"
        class="nc-script-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
        :class="{
          'bg-gray-200': isMarked === script.id,
          'active': activeAutomationId === script.id,
        }"
        :on-validate="validate"
        :script="script"
        @change-script="changeScript"
        @rename="onRename"
        @delete="openDeleteDialog"
      />
    </template>
  </a-menu>
</template>

<style lang="scss">
.nc-scripts-menu {
  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  &.dragging {
    .nc-icon {
      @apply !hidden;
    }

    .nc-view-icon {
      @apply !block;
    }
  }

  .ant-menu-item:not(.sortable-chosen) {
    @apply color-transition;
  }

  .ant-menu-title-content {
    @apply !w-full;
  }

  .sortable-chosen {
    @apply !bg-gray-200;
  }

  .active {
    @apply !bg-primary-selected font-medium;
  }
}
</style>
