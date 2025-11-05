<script setup lang="ts">
import Sortable from 'sortablejs'
import { type SortableEvent } from 'sortablejs'
import { type WorkflowType } from 'nocodb-sdk'
import type { Menu as AntMenu } from 'ant-design-vue/lib/components'

const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { $e } = useNuxtApp()

const { t } = useI18n()

const { addUndo, defineModelScope } = useUndoRedo()

const { ncNavigateTo, isMobileMode } = useGlobal()

const bases = useBases()

const { isUIAllowed } = useRoles()

const { isSharedBase } = storeToRefs(useBase())

const { openedProject, baseHomeSearchQuery } = storeToRefs(bases)

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const workflowStore = useWorkflowStore()

const { updateWorkflow, openNewWorkflowModal } = workflowStore

const { activeWorkflowId, workflows: workflowsMap } = storeToRefs(workflowStore)

const workflows = computed(() => workflowsMap.value.get(baseId.value) ?? [])

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

  if (workflows.value.length < 2) return

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
      scope: defineModelScope({ view: activeWorkflowId.value }),
    })
  }

  const children = Array.from(evt.to.children as unknown as HTMLLIElement[])

  // remove `Create View` children from list
  children.shift()

  const previousEl = children[newIndex - 1]
  const nextEl = children[newIndex + 1]

  const currentItem = workflows.value.find((v) => v.id === evt.item.id)

  if (!currentItem || !currentItem.id) return

  // set default order value as 0 if item not found
  const previousItem = (
    previousEl ? workflows.value.find((v) => v.id === previousEl.id) ?? { order: 0 } : { order: 0 }
  ) as WorkflowType
  const nextItem = (nextEl ? workflows.value.find((v) => v.id === nextEl.id) : {}) as WorkflowType

  let nextOrder: number

  // set new order value based on the new order of the items
  if (workflows.value.length - 1 === newIndex) {
    nextOrder = parseFloat(String(previousItem.order)) + 1
  } else if (newIndex === 0) {
    nextOrder = parseFloat(String(nextItem.order)) / 2
  } else {
    nextOrder = (parseFloat(String(previousItem.order)) + parseFloat(String(nextItem.order))) / 2
  }

  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

  currentItem.order = _nextOrder

  await updateWorkflow(baseId.value, currentItem.id, {
    order: currentItem.order,
  })

  markItem(currentItem.id)

  $e('a:workflow:reorder')
}

async function changeWorkflow(workflow: WorkflowType) {
  ncNavigateTo({
    workspaceId: activeWorkspaceId.value,
    baseId: baseId.value,
    workflowId: workflow.id,
    workflowTitle: workflow.title,
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

/** validate workflow title */
function validate(workflow: WorkflowType) {
  if (!workflow.title || workflow.title.trim().length < 0) {
    return t('msg.error.workflowNameRequired')
  }

  if (workflows.value.some((a) => a.title === workflow.title && a.id !== workflow.id)) {
    return t('msg.error.workflowNameDuplicate')
  }

  return true
}

async function onRename(workflow: WorkflowType, originalTitle?: string, undo = false) {
  try {
    await updateWorkflow(workflow.base_id, workflow.id as string, {
      title: workflow.title,
      order: workflow.order,
    })

    if (!undo) {
      addUndo({
        redo: {
          fn: (a: WorkflowType, title: string) => {
            const tempTitle = a.title
            a.title = title
            onRename(a, tempTitle, true)
          },
          args: [workflow, workflow.title],
        },
        undo: {
          fn: (a: WorkflowType, title: string) => {
            const tempTitle = a.title
            a.title = title
            onRename(a, tempTitle, true)
          },
          args: [workflow, originalTitle],
        },
        scope: defineModelScope({ base_id: workflow.base_id }),
      })
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const updateWorkflowIcon = async (icon: string, workflow: WorkflowType) => {
  try {
    // modify the icon property in meta
    workflow.meta = {
      ...parseProp(workflow.meta),
      icon,
    }

    await updateWorkflow(workflow.base_id, workflow.id!, {
      meta: workflow.meta,
    })

    $e('a:workflow:icon:sidebar', { icon })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Open delete modal */
function openDeleteDialog(workflow: WorkflowType) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgWorkflowDelete'), {
    'modelValue': isOpen,
    'workflow': workflow,
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
    ...getDraggableAutoScrollOptions({ scrollSensitivity: 50 }),
  })
}

onMounted(() => {
  if (isUIAllowed('workflowCreateOrEdit') && menuRef.value) {
    initSortable(menuRef.value.$el)
  }
})

const filteredWorkflows = computed(() => {
  return workflows.value.filter((workflow) => searchCompare(workflow.title, baseHomeSearchQuery.value))
})
</script>

<template>
  <a-menu
    ref="menuRef"
    :class="{ dragging }"
    :selected-keys="selected"
    class="nc-workflows-menu flex flex-col w-full !border-r-0 !bg-inherit"
  >
    <template v-if="!workflows?.length && !isSharedBase && isUIAllowed('workflowCreateOrEdit')">
      <div @click="openNewWorkflowModal({ baseId })">
        <div
          :class="{
            'text-nc-content-brand hover:text-nc-content-brand-disabled': openedProject?.id === baseId,
            'text-nc-content-gray-muted hover:text-nc-content-brand': openedProject?.id !== baseId,
          }"
          class="nc-create-workflow-btn flex flex-row items-center cursor-pointer rounded-md w-full"
          role="button"
        >
          <div class="nc-project-home-section-item">
            <GeneralIcon icon="plus" />
            <div>
              {{
                $t('general.createEntity', {
                  entity: 'workflow',
                })
              }}
            </div>
          </div>
        </div>
      </div>
    </template>
    <div
      v-if="!workflows?.length || !filteredWorkflows.length"
      class="nc-project-home-section-item text-nc-content-gray-muted font-normal"
    >
      {{ workflows?.length && !filteredWorkflows.length ? $t('placeholder.noResultsFoundForYourSearch') : 'No workflows' }}
    </div>
    <template v-if="filteredWorkflows?.length">
      <DashboardTreeViewWorkflowNode
        v-for="workflow of filteredWorkflows"
        :id="workflow.id"
        :key="workflow.id"
        class="nc-workflow-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
        :class="{
          'bg-nc-bg-gray-medium': isMarked === workflow.id,
          'active': activeWorkflowId === workflow.id,
        }"
        :on-validate="validate"
        :workflow="workflow"
        @change-workflow="changeWorkflow"
        @rename="onRename"
        @delete="openDeleteDialog"
        @select-icon="updateWorkflowIcon($event, workflow)"
      />
    </template>
  </a-menu>
</template>

<style lang="scss">
.nc-workflows-menu {
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
    @apply !bg-nc-bg-gray-medium;
  }

  .active {
    @apply !bg-primary-selected font-medium;
  }
}
</style>
