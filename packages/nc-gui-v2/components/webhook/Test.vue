<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import { MetaInj } from '~/context'

interface Props {
  hook: Record<string, any>
}

const { hook } = defineProps<Props>()

const { $state, $api, $e } = useNuxtApp()
const meta = inject(MetaInj)
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
  sampleData.value = {
    data: $api.dbTableWebhook.samplePayloadGet(meta?.value?.id as string, hook?.operation),
    user: $state.user.value as Record<string, any>,
  }
}

onMounted(async () => {
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
