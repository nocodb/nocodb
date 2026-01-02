<script setup lang="ts">
const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { isUIAllowed } = useRoles()

const scriptStore = useScriptStore()

const { loadScripts } = scriptStore

const workflowStore = useWorkflowStore()

const { loadWorkflows } = workflowStore

const { activeWorkflowId, activeWorkflow, workflows } = storeToRefs(workflowStore)

const { isMarketVisible, isDetailsVisible, detailsScriptId, activeScriptId, activeScript, scripts } = storeToRefs(scriptStore)

const bases = useBases()

const { openedProject } = storeToRefs(bases)

const isExpanded = ref(true)

const onExpand = async () => {
  if (isUIAllowed('workflowList')) {
    loadWorkflows({ baseId: baseId.value })
  }
  loadScripts({ baseId: baseId.value })
  isExpanded.value = !isExpanded.value
}

watch(
  () => activeScript.value?.id,
  async () => {
    if (!activeScript.value) return

    await loadScripts({ baseId: baseId.value })

    if (activeScript.value?.base_id === openedProject.value?.id) {
      isExpanded.value = true
    }
  },
  {
    immediate: true,
  },
)

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

let scriptTimeout: NodeJS.Timeout

watch(activeScriptId, () => {
  loadScripts({ baseId: baseId.value })

  if (scriptTimeout) {
    clearTimeout(scriptTimeout)
  }

  if (activeScriptId.value && isExpanded.value) {
    const _scripts = scripts.value.get(baseId.value) ?? []

    if (_scripts.length) return

    scriptTimeout = setTimeout(() => {
      if (isExpanded.value) {
        isExpanded.value = false
      }
      clearTimeout(scriptTimeout)
    }, 10000)
  }
})

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
  <div class="nc-tree-item nc-automation-node-wrapper nc-project-home-section text-sm select-none w-full nc-base-tree-automation">
    <div v-e="['c:automation:toggle-expand']" class="nc-project-home-section-header w-full cursor-pointer" @click.stop="onExpand">
      <div>{{ $t('general.automations') }}</div>
      <div class="flex-1" />
      <GeneralIcon
        icon="chevronRight"
        class="flex-none nc-sidebar-source-node-btns text-nc-content-gray-muted cursor-pointer transform transition-transform duration-200 text-[20px]"
        :class="{ '!rotate-90': isExpanded }"
      />
    </div>
    <DashboardTreeViewAutomationList v-if="isExpanded" :base-id="baseId!" />

    <ScriptsMarket v-model:model-value="isMarketVisible" />
    <ScriptsDetails v-if="isDetailsVisible && detailsScriptId" v-model="isDetailsVisible" :script-id="detailsScriptId" />
  </div>
</template>
