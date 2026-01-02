<script setup lang="ts">
import Sortable from 'sortablejs'
import { type SortableEvent } from 'sortablejs'
import { AutomationTypes, type ScriptType, type WorkflowType } from 'nocodb-sdk'

const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { $e } = useNuxtApp()

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const isScriptsCreateOrEditAllowed = computed(() => isUIAllowed('scriptCreateOrEdit'))

const isWorkflowsCreateOrEditAllowed = computed(() => isUIAllowed('workflowCreateOrEdit'))

const scriptStore = useScriptStore()

const workflowStore = useWorkflowStore()

const { updateScript, openNewScriptModal } = scriptStore

const { updateWorkflow, openNewWorkflowModal } = workflowStore

const { activeScriptId, scripts: allScripts, activeBaseScripts } = storeToRefs(scriptStore)

const { activeWorkflowId, workflows: allWorkflows, activeBaseWorkflows, isWorkflowsEnabled } = storeToRefs(workflowStore)

const scripts = computed(() => allScripts.value.get(baseId.value) ?? [])

const workflows = computed(() => allWorkflows.value.get(baseId.value) ?? [])

const menuRef = useTemplateRef('menuRef')

const isMarked = ref<string | false>(false)

const keys = ref<Record<string, number>>({})

const dragging = ref(false)

let sortable: Sortable

const allEntities = computed<Array<(WorkflowType & { type: 'workflow' }) | (ScriptType & { type: 'script' })>>(() => {
  const entities = []

  entities.push(...scripts.value.map((s) => ({ ...s, type: 'script' })))
  entities.push(...workflows.value.map((w) => ({ ...w, type: 'workflow' })))

  return entities.sort((a, b) => (a.order || 0) - (b.order || 0))
})

// Create entities by ID lookup for efficient access
const entitiesById = computed(() =>
  allEntities.value.reduce<Record<string, any>>((acc, entity) => {
    acc[entity.id!] = entity
    return acc
  }, {}),
)

/** shortly mark an item after sorting */
function markItem(id: string) {
  isMarked.value = id
  setTimeout(() => {
    isMarked.value = false
  }, 300)
}

const initSortable = (el: Element) => {
  if (isMobileMode.value) return
  if (sortable) sortable.destroy()

  sortable = Sortable.create(el as HTMLElement, {
    ghostClass: 'ghost',
    onStart: (evt: SortableEvent) => {
      evt.stopImmediatePropagation()
      evt.preventDefault()
      dragging.value = true
    },
    onEnd: async (evt) => {
      const { newIndex = 0, oldIndex = 0 } = evt

      evt.stopImmediatePropagation()
      evt.preventDefault()

      dragging.value = false

      if (newIndex === oldIndex) return

      const itemEl = evt.item as HTMLElement
      const item = entitiesById.value[itemEl.dataset.id as string]

      if (!item) return

      // get the html collection of all list items
      const children: HTMLCollection = evt.to.children

      // skip if children count is 1
      if (children.length < 2) return

      // get items before and after the moved item
      const itemBeforeEl = children[newIndex - 1] as HTMLElement
      const itemAfterEl = children[newIndex + 1] as HTMLElement

      // get items meta of before and after the moved item
      const itemBefore = itemBeforeEl && entitiesById.value[itemBeforeEl.dataset.id as string]
      const itemAfter = itemAfterEl && entitiesById.value[itemAfterEl.dataset.id as string]

      // set new order value based on the new order of the items
      if (children.length - 1 === newIndex) {
        // Item moved to last position
        item.order = (itemBefore?.order ?? 0) + 1
      } else if (newIndex === 0) {
        // Item moved to first position
        item.order = (itemAfter?.order ?? 1) / 2
      } else {
        // Item moved to middle position
        item.order = ((itemBefore?.order ?? 0) + (itemAfter?.order ?? 0)) / 2
      }

      if (item.type === AutomationTypes.SCRIPT) {
        const scripts = activeBaseScripts.value
        const scriptsIndex = scripts.findIndex((d) => d.id === item.id)
        if (scriptsIndex !== -1) {
          scripts[scriptsIndex].order = item.order
        }
      } else if (item.type === AutomationTypes.WORKFLOW) {
        const workflows = activeBaseWorkflows.value
        const workflowsIndex = workflows.findIndex((t) => t.id === item.id)
        if (workflowsIndex !== -1) {
          workflows[workflowsIndex].order = item.order
        }
      }

      // force re-render the list
      if (keys.value.data) {
        keys.value.data = keys.value.data + 1
      } else {
        keys.value.data = 1
      }

      // Update backend based on item type
      if (item.type === AutomationTypes.SCRIPT) {
        await updateScript(baseId.value, item.id, {
          order: item.order,
        })
      } else if (item.type === AutomationTypes.WORKFLOW) {
        await updateWorkflow(baseId.value, item.id, {
          order: item.order,
        })
      }

      markItem(item.id)
      $e('a:data:reorder')
    },
    setData(dataTransfer, dragEl) {
      if (!dragEl?.dataset?.id) {
        return
      }
      dataTransfer.setData(
        'text/json',
        JSON.stringify({
          id: dragEl.dataset.id,
          title: dragEl.dataset.title,
          type: dragEl.dataset.type,
          sourceId: dragEl.dataset.sourceId,
        }),
      )
    },
    animation: 150,
    revertOnSpill: true,
    filter: isTouchEvent,
    ...getDraggableAutoScrollOptions({ scrollSensitivity: 50 }),
  })
}

watchEffect(() => {
  if (menuRef.value && isUIAllowed('scriptCreateOrEdit')) {
    initSortable(menuRef.value)
  }
})
</script>

<template>
  <div>
    <template v-if="!allEntities.length && isUIAllowed('workflowCreateOrEdit')">
      <NcDropdown
        v-if="isWorkflowsEnabled && (isWorkflowsCreateOrEditAllowed || isScriptsCreateOrEditAllowed)"
        overlay-class-name="nc-automation-create-dropdown"
      >
        <div
          class="nc-create-table-btn flex flex-row items-center cursor-pointer rounded-md w-full text-nc-content-brand hover:text-nc-content-brand-disabled"
          role="button"
        >
          <div class="nc-project-home-section-item">
            <GeneralIcon icon="plus" />
            <div>
              {{
                $t('general.createEntity', {
                  entity: $t('objects.automation'),
                })
              }}
            </div>
          </div>
        </div>
        <template #overlay>
          <NcMenu class="max-w-54" variant="medium">
            <NcMenuItem v-if="isScriptsCreateOrEditAllowed" @click="openNewScriptModal({ baseId })">
              <div class="item">
                <div class="item-inner">
                  <GeneralIcon icon="ncScript" />
                  <div>
                    {{ $t('objects.script') }}
                  </div>
                </div>

                <GeneralIcon class="plus" icon="plus" />
              </div>
            </NcMenuItem>
            <NcMenuItem v-if="isWorkflowsCreateOrEditAllowed" @click="openNewWorkflowModal({ baseId })">
              <div class="item">
                <div class="item-inner">
                  <GeneralIcon icon="ncAutomation" />
                  <div>
                    {{ $t('objects.workflow') }}
                  </div>
                  <NcBadgeBeta />
                </div>
                <GeneralIcon class="plus" icon="plus" />
              </div>
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
      <div
        v-else-if="isScriptsCreateOrEditAllowed"
        class="nc-create-table-btn flex flex-row items-center cursor-pointer rounded-md w-full text-nc-content-brand hover:text-nc-content-brand-disabled"
        role="button"
        @click="openNewScriptModal({ baseId })"
      >
        <div class="nc-project-home-section-item">
          <GeneralIcon icon="plus" />
          <div>
            {{
              $t('general.createEntity', {
                entity: $t('objects.automation'),
              })
            }}
          </div>
        </div>
      </div>
    </template>

    <div
      v-else-if="!allEntities.length && !isUIAllowed('workflowCreateOrEdit')"
      class="py-0.5 text-nc-content-gray-muted nc-project-home-section-item font-normal"
    >
      {{ $t('placeholder.noAutomations') }}
    </div>
    <div
      v-else
      ref="menuRef"
      :key="`data-${keys.data || 0}`"
      :class="{ dragging }"
      class="nc-automation-menu flex flex-col w-full !border-r-0 bg-nc-bg-gray-sidebar"
    >
      <template v-for="entity of allEntities" :key="entity.id">
        <DashboardTreeViewAutomationWorkflowNode
          v-if="entity.type === AutomationTypes.WORKFLOW"
          :data-id="entity.id"
          :data-order="entity.order"
          :data-title="entity.title"
          :data-type="entity.type"
          :workflow="entity"
          class="nc-workflow-item nc-tree-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
          :class="{
            'bg-nc-bg-gray-medium': isMarked === entity.id,
            'active': activeWorkflowId === entity.id,
          }"
        />
        <DashboardTreeViewAutomationScriptNode
          v-else
          :data-id="entity.id"
          :data-order="entity.order"
          :data-title="entity.title"
          :data-type="entity.type"
          :script="entity"
          class="nc-script-item nc-tree-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
          :class="{
            'bg-nc-bg-gray-medium': isMarked === entity.id,
            'active': activeScriptId === entity.id,
          }"
        />
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.item {
  @apply flex flex-row items-center w-39 justify-between;
}

.item-inner {
  @apply flex flex-row items-center gap-x-1.75;
}

.plus {
  @apply text-nc-content-gray-muted;
}
</style>

<style lang="scss">
.nc-automation-menu {
  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  .ghost {
    @apply !bg-nc-bg-gray-medium;
  }

  &.dragging {
    .nc-view-icon {
      @apply !block;
    }
  }

  .active {
    @apply !bg-primary-selected dark:!bg-nc-bg-gray-medium font-medium;
  }
}

.nc-automation-create-dropdown {
  @apply !max-w-45 !min-w-45 !left-18;
}
</style>
