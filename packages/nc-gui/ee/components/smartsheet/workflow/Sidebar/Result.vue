<script setup lang="ts">
import dayjs from 'dayjs'
import VariableDisplay from './VariableDisplay.vue'

const { selectedNode, getNodeMetaById } = useWorkflowOrThrow()

const isInputExpanded = ref(true)

const isOutputExpanded = ref(true)

const isTestResultStale = computed(() => selectedNode.value?.data?.testResult?.isStale === true)

const testResult = computed(() => {
  return selectedNode.value?.data?.testResult
})

const nodeMeta = computed(() => {
  if (!selectedNode.value || !selectedNode.value.type) return null
  return getNodeMetaById(selectedNode.value.type)
})

const inputVariables = computed(() => {
  return testResult.value?.inputVariables || []
})

const outputVariables = computed(() => {
  return testResult.value?.outputVariables || []
})

const inputData = computed(() => {
  return testResult.value?.input
})

const outputData = computed(() => {
  return testResult.value?.output
})
</script>

<template>
  <NcGroupedSettings v-if="testResult" title="Results">
    <NcAlert v-if="isTestResultStale" type="warning">
      <template #message> Stale results </template>
      <template #description> The results may be out of date. Please test this step again. </template>
    </NcAlert>

    <div class="space-y-3">
      <div class="space-y-1">
        <div v-if="testResult.status === 'success'" class="text-bodyBold text-nc-content-green-dark">Step successful</div>
        <div v-else-if="testResult.status === 'error'" class="text-bodyBold text-nc-content-red-dark">Step failed</div>
        <div class="text-bodySm text-nc-content-gray-subtle">
          Step run {{ dayjs(testResult.endTime || testResult.startTime).fromNow() }}
        </div>
      </div>

      <div class="border-1 border-nc-border-gray-medium rounded-md cursor-pointer overflow-hidden">
        <div
          :class="{
            'border-b-1 border-nc-border-gray-extralight hover:border-nc-border-gray-medium': isInputExpanded,
          }"
          class="flex items-center py-1 px-3 justify-between hover:bg-nc-bg-gray-extralight"
          @click="isInputExpanded = !isInputExpanded"
        >
          <div class="text-captionBold text-nc-content-gray-emphasis">Input</div>

          <NcButton type="text" size="xxsmall">
            <GeneralIcon
              icon="ncChevronRight"
              class="transition-all transform"
              :class="{
                'rotate-90': isInputExpanded,
              }"
            />
          </NcButton>
        </div>

        <div v-if="isInputExpanded">
          <VariableDisplay :variables="inputVariables" :data="inputData" />
        </div>
      </div>

      <div class="border-1 border-nc-border-gray-medium rounded-md cursor-pointer overflow-hidden">
        <div
          :class="{
            'border-b-1 border-nc-border-gray-extralight hover:border-nc-border-gray-medium': isOutputExpanded,
          }"
          class="flex items-center py-1 px-3 justify-between hover:bg-nc-bg-gray-extralight"
          @click="isOutputExpanded = !isOutputExpanded"
        >
          <div class="flex items-center gap-2">
            <GeneralIcon v-if="nodeMeta" :icon="nodeMeta.icon" />

            <div class="text-captionBold text-nc-content-gray-emphasis">Output</div>
          </div>

          <NcButton type="text" size="xxsmall">
            <GeneralIcon
              icon="ncChevronRight"
              class="transition-all transform"
              :class="{
                'rotate-90': isOutputExpanded,
              }"
            />
          </NcButton>
        </div>

        <div v-if="isOutputExpanded">
          <VariableDisplay :variables="outputVariables" :data="outputData" />
        </div>
      </div>
    </div>
  </NcGroupedSettings>
</template>
