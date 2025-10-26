<script lang="ts" setup>
import type { OAuthClient } from 'nocodb-sdk'

interface Props {
  modelValue: boolean
  oauthClient: OAuthClient
}

interface Emits {
  (event: 'update:modelValue', data: boolean): void
  (event: 'deleted'): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { oauthClient } = props

const vModel = useVModel(props, 'modelValue', emits)

const { deleteOAuthClient } = useOAuthClients()

async function onDelete() {
  if (!oauthClient.client_id) return

  try {
    const success = await deleteOAuthClient(oauthClient.client_id)

    if (success) {
      message.success('OAuth client deleted successfully!')
      vModel.value = false
      emits('deleted')
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <GeneralDeleteModal v-model:visible="vModel" entity-name="OAuth Client" :on-delete="onDelete" :show-default-delete-msg="false">
    <template #entity-preview>
      <div class="text-nc-content-gray-subtle text-sm mb-3">
        Are you sure you want to delete
        <span class="font-semibold">{{ oauthClient.client_name }}</span
        >? This action cannot be undone and will immediately revoke all access tokens.
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
    </template>
  </GeneralDeleteModal>
</template>
