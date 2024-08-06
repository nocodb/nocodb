<script setup lang="ts">
import type { HookTestReqType, HookType } from 'nocodb-sdk'

interface Props {
  hook: HookType
}

const { hook } = defineProps<Props>()

const emits = defineEmits(['success', 'error'])

const { t } = useI18n()

const { $api } = useNuxtApp()

const meta = inject(MetaInj, ref())

const sampleData = ref()

const [isVisible, toggleVisibility] = useToggle()

watch(
  () => hook?.operation,
  async () => {
    await loadSampleData()
  },
)

async function loadSampleData() {
  sampleData.value = await $api.dbTableWebhook.samplePayloadGet(
    meta?.value?.id as string,
    hook?.operation || 'insert',
    hook.version!,
  )
}

async function testWebhook() {
  try {
    await $api.dbTableWebhook.test(
      meta.value?.id as string,
      {
        hook,
        payload: sampleData.value,
      } as HookTestReqType,
    )

    // Webhook tested successfully
    emits('success')

    message.success(t('msg.success.webhookTested'))
  } catch (e: any) {
    emits('error')
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
  <NcButton class="!w-full justify-between" type="text" size="small" @click="toggleVisibility()">
    <div class="flex items-center min-w-full justify-between">
      Sample Payload

      <GeneralIcon
        class="transition-transform"
        :class="{
          'transform rotate-180': isVisible,
        }"
        icon="arrowDown"
      />
    </div>
  </NcButton>
  <LazyMonacoEditor
    v-show="isVisible"
    v-model="sampleData"
    monaco-config="{

"
    class="transition-all"
    :class="{
      'w-0 min-w-0': !isVisible,
      'min-h-60 max-h-80': isVisible,
    }"
  />
</template>

<style scoped lang="scss">
.nc-button :not(.nc-icon):not(.material-symbols) {
  @apply !w-full;
}
</style>
