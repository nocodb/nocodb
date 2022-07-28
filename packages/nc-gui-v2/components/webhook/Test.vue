<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import { useToast } from 'vue-toastification'
import { MetaInj } from '~/context'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'

interface Props {
  hook: Record<string, any>
}

const { hook } = defineProps<Props>()

const { $state, $api, $e } = useNuxtApp()

const toast = useToast()

const meta = inject(MetaInj)

const sampleData = ref({
  data: {},
  user: {},
})
const activeKey = ref(0)

watch(
  () => hook?.operation,
  async (v) => {
    await loadSampleData()
  },
)

async function loadSampleData() {
  sampleData.value = {
    data: await $api.dbTableWebhook.samplePayloadGet(meta?.value?.id as string, hook?.operation),
    user: $state.user.value as Record<string, any>,
  }
}

async function testWebhook() {
  try {
    await $api.dbTableWebhook.test(meta?.value.id as string, {
      hook,
      payload: sampleData.value,
    })

    toast.success('Webhook tested successfully')
  } catch (e: any) {
    toast.error(await extractSdkResponseErrorMsg(e))
  }
}

defineExpose({
  testWebhook,
})

onMounted(async () => {
  await loadSampleData()
})
</script>

<template>
  <a-collapse v-model:activeKey="activeKey" ghost>
    <a-collapse-panel key="1" header="Sample Payload">
      <MonacoEditor v-model="sampleData" class="min-h-60 max-h-80" />
    </a-collapse-panel>
  </a-collapse>
</template>
