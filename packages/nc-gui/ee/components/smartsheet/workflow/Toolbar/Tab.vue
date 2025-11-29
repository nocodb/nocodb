<script setup lang="ts">
const { activeTab } = useWorkflowOrThrow()

const tabs = [
  {
    label: 'Editor',
    value: 'editor',
    icon: 'ncAutomation',
  },
  {
    label: 'Logs',
    value: 'logs',
    icon: 'audit',
  },
  {
    label: 'Settings',
    value: 'settings',
    icon: 'settings',
  },
]

const highlightStyle = ref({ left: '0px', width: '0px' })

const setActiveTab = (tabValue: string, event: MouseEvent) => {
  activeTab.value = tabValue
  const tabElement = event.currentTarget as HTMLElement
  highlightStyle.value.left = `${tabElement.offsetLeft}px`
  highlightStyle.value.width = `${tabElement.offsetWidth}px`
}

const updateHighlightPosition = () => {
  nextTick(() => {
    const activeTabElement = document.querySelector('.workflow-tab.active') as HTMLElement
    if (activeTabElement) {
      highlightStyle.value.left = `${activeTabElement.offsetLeft}px`
      highlightStyle.value.width = `${activeTabElement.offsetWidth}px`
    }
  })
}

onMounted(() => {
  updateHighlightPosition()
})

watch(activeTab, () => {
  updateHighlightPosition()
})
</script>

<template>
  <div class="flex relative items-center gap-2">
    <div :style="highlightStyle" class="highlight h-0.5 rounded-t-md absolute transition-all -bottom-2 bg-nc-content-brand"></div>
    <div
      v-for="tab in tabs"
      :key="tab.value"
      :class="{
        'text-nc-content-brand font-bold active': activeTab === tab.value,
        'text-nc-content-gray-muted': activeTab !== tab.value,
      }"
      class="flex items-center gap-2 text-bodyBold px-2 py-1 cursor-pointer rounded-lg transition-all duration-300 workflow-tab"
      @click="setActiveTab(tab.value, $event)"
    >
      <GeneralIcon :icon="tab.icon" />
      {{ tab.label }}
    </div>
  </div>
</template>
