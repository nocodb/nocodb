<script setup lang="ts">
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const automationStore = useAutomationStore()

const { loadAutomations } = automationStore

const { isMarketVisible, isDetailsVisible, detailsScriptId, activeAutomationId, activeAutomation, automations } =
  storeToRefs(automationStore)

const bases = useBases()

const { openedProject } = storeToRefs(bases)

const isOptionsOpen = ref(false)

const isExpanded = ref(true)

const onExpand = async () => {
  loadAutomations({ baseId: baseId.value })
  isOptionsOpen.value = !isOptionsOpen.value
  isExpanded.value = !isExpanded.value
}

watch(
  () => activeAutomation.value?.id,
  async () => {
    if (!activeAutomation.value) return

    await loadAutomations({ baseId: baseId.value })

    if (activeAutomation.value?.base_id === openedProject.value?.id) {
      isExpanded.value = true
    }
  },
  {
    immediate: true,
  },
)

let automationTimeout: NodeJS.Timeout

watch(activeAutomationId, () => {
  loadAutomations({ baseId: baseId.value })

  if (automationTimeout) {
    clearTimeout(automationTimeout)
  }

  if (activeAutomationId.value && isExpanded.value) {
    const _automations = automations.value.get(baseId.value) ?? []

    if (_automations.length) return

    automationTimeout = setTimeout(() => {
      if (isExpanded.value) {
        isExpanded.value = false
      }
      clearTimeout(automationTimeout)
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
