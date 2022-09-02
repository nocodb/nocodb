<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { MetaInj } from '~/context'
import { extractSdkResponseErrorMsg } from '~/utils'

const { hook } = defineProps<Props>()

const { t } = useI18n()

interface Props {
  hook: Record<string, any>
}

const { $api } = useNuxtApp()

const meta = inject(MetaInj)

const sampleData = ref({
  data: {},
})
const activeKey = ref(0)

watch(
  () => hook?.operation,
  async () => {
    await loadSampleData()
  },
)

async function loadSampleData() {
  sampleData.value = {
    data: await $api.dbTableWebhook.samplePayloadGet(meta?.value?.id as string, hook?.operation || 'insert'),
  }
}

async function testWebhook() {
  try {
    await $api.dbTableWebhook.test(meta?.value.id as string, {
      hook,
      payload: sampleData.value,
    })

    // Webhook tested successfully
    message.success(t('msg.success.webhookTested'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
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
