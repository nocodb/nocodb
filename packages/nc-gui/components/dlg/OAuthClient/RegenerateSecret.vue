<script lang="ts" setup>
import type { OAuthClient } from 'nocodb-sdk'

interface Props {
  modelValue: boolean
  oauthClient: OAuthClient
}

interface Emits {
  (event: 'update:modelValue', data: boolean): void
  (event: 'regenerated'): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { oauthClient } = props

const vModel = useVModel(props, 'modelValue', emits)

const { regenerateClientSecret } = useOAuthClients()

const isRegenerating = ref(false)

async function onRegenerate() {
  if (!oauthClient.client_id) return

  try {
    isRegenerating.value = true
    const updated = await regenerateClientSecret(oauthClient.client_id)

    if (updated) {
      message.success('Client secret regenerated successfully! Make sure to copy it now.')
      vModel.value = false
      emits('regenerated')
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isRegenerating.value = false
  }
}
</script>

<template>
  <GeneralModal v-model:visible="vModel" size="small" class="!w-[440px]">
    <div class="flex flex-col gap-4 p-6">
      <div class="flex items-start gap-3">
        <GeneralIcon icon="alertTriangle" class="flex-none !text-nc-orange-500 h-5 w-5 mt-0.5" />
        <div class="flex flex-col gap-1">
          <h3 class="font-bold text-base text-nc-content-gray-emphasis">Regenerate Client Secret</h3>
          <div class="text-sm text-nc-content-gray-subtle">
            Are you sure you want to regenerate the client secret for
            <span class="font-semibold">{{ oauthClient.client_name }}</span
            >?
          </div>
        </div>
      </div>

      <div class="flex flex-row items-center py-2 px-3 bg-nc-bg-gray-extralight rounded-lg text-gray-700">
        <div
          class="capitalize text-ellipsis overflow-hidden font-bold select-none w-full pl-3"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          <span>
            {{ oauthClient.client_name }}
          </span>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-2">
        <NcButton type="secondary" size="small" @click="vModel = false"> Cancel </NcButton>
        <NcButton type="danger" size="small" :loading="isRegenerating" @click="onRegenerate">
          {{ isRegenerating ? 'Regenerating...' : 'Regenerate Secret' }}
        </NcButton>
      </div>
    </div>
  </GeneralModal>
</template>
