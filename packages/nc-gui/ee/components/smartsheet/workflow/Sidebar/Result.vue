<script setup lang="ts">
import dayjs from 'dayjs'

const { selectedNode } = useWorkflowOrThrow()

const isTestResultStale = computed(() => selectedNode.value?.data?.testResult?.isStale === true)

const testResult = computed(() => {
  return selectedNode.value?.data?.testResult
})
</script>

<template>
  <NcGroupedSettings v-if="testResult" title="Results">
    <NcAlert v-if="isTestResultStale" type="warning">
      <template #message> Stale results </template>
      <template #description> The results may be out of date. Please test this step again. </template>
    </NcAlert>

    <div>
      <div class="space-y-1">
        <div v-if="testResult.status === 'success'" class="text-bodyBold text-nc-content-green-dark">Step successful</div>
        <div v-else-if="testResult.status === 'error'" class="text-bodyBold text-nc-content-red-dark">Step failed</div>
        <div class="text-bodySm text-nc-content-gray-subtle">
          Step run {{ dayjs(testResult.endTime || testResult.startTime).fromNow() }}
        </div>
      </div>
    </div>
  </NcGroupedSettings>
</template>

<style scoped lang="scss"></style>
