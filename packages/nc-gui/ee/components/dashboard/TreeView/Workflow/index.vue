<script setup lang="ts">
const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const workflowStore = useWorkflowStore()

const { loadWorkflows } = workflowStore

const { activeWorkflowId, activeWorkflow, workflows } = storeToRefs(workflowStore)

const bases = useBases()

const { openedProject } = storeToRefs(bases)

const isExpanded = ref(true)

const onExpand = async () => {
  loadWorkflows({ baseId: baseId.value })
  isExpanded.value = !isExpanded.value
}

watch(
  () => activeWorkflow.value?.id,
  async () => {
    if (!activeWorkflow.value) return

    await loadWorkflows({ baseId: baseId.value })

    if (activeWorkflow.value?.base_id === openedProject.value?.id) {
      isExpanded.value = true
    }
  },
  {
    immediate: true,
  },
)

let workflowTimeout: NodeJS.Timeout

watch(activeWorkflowId, () => {
  loadWorkflows({ baseId: baseId.value })

  if (workflowTimeout) {
    clearTimeout(workflowTimeout)
  }

  if (activeWorkflowId.value && isExpanded.value) {
    const _workflows = workflows.value.get(baseId.value) ?? []

    if (_workflows.length) return

    workflowTimeout = setTimeout(() => {
      if (isExpanded.value) {
        isExpanded.value = false
      }
      clearTimeout(workflowTimeout)
    }, 10000)
  }
})
</script>

<template>
  <div class="nc-tree-item nc-workflow-node-wrapper nc-project-home-section text-sm select-none w-full nc-base-tree-workflow">
    <div v-e="['c:workflow:toggle-expand']" class="nc-project-home-section-header w-full cursor-pointer" @click.stop="onExpand">
      <div>Workflows</div>
      <div class="flex-1" />
      <GeneralIcon
        icon="chevronRight"
        class="flex-none nc-sidebar-source-node-btns text-nc-content-gray-muted cursor-pointer transform transition-transform duration-200 text-[20px]"
        :class="{ '!rotate-90': isExpanded }"
      />
    </div>
    <DashboardTreeViewWorkflowList v-if="isExpanded" :base-id="baseId!" />
  </div>
</template>
