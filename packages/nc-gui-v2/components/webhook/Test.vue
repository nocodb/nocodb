<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'

interface Props {
  hook: Record<string, any>
}

const { hook } = defineProps<Props>()

const { $state, $api, $e } = useNuxtApp()

const { getMeta, removeMeta } = useMetas()
const isVisible = ref(false)
const sampleData = ref({
  data: {},
  user: {},
})
const activeKey = ref(1)

watch(
  () => hook?.operation,
  async (v) => {
    await loadSampleData()
  },
)

async function loadSampleData() {
  // TODO: get model id
  const modelId = 'XXX'
  sampleData.value = {
    data: $api.dbTableWebhook.samplePayloadGet(modelId, hook?.operation),
    user: $state.user.value as Record<string, any>,
  }
}

onMounted(async () => {
  console.log(hook)
  await loadSampleData()
})
</script>

<template>
  <a-collapse v-model:activeKey="activeKey" ghost>
    <a-collapse-panel key="1" header="Sample Payload">
      <!-- TODO: need changes from Quick Import PR -->
      <MonacoEditor v-model:value="sampleData" read-only class="caption mb-2 min-h-75" />
    </a-collapse-panel>
  </a-collapse>
</template>
