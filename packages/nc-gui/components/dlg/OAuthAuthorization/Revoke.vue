<script lang="ts" setup>
import type { OAuthAuthorization } from '#imports'

interface Props {
  modelValue: boolean
  authorization: OAuthAuthorization
}

interface Emits {
  (event: 'update:modelValue', data: boolean): void
  (event: 'revoked'): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { authorization } = props

const vModel = useVModel(props, 'modelValue', emits)

const authStore = useOAuthAuthorizations()

async function onRevoke() {
  if (!authorization.id) return

  try {
    const success = await authStore.revokeAuthorization(authorization.id)

    if (success) {
      message.success('Access revoked successfully')
      vModel.value = false
      emits('revoked')
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <GeneralDeleteModal
    v-model:visible="vModel"
    :entity-name="$t('general.authorization')"
    :on-delete="onRevoke"
    :show-default-delete-msg="false"
    :delete-label="$t('general.revoke')"
  >
    <template #entity-preview>
      <div class="text-nc-content-gray-subtle text-sm">
        Are you sure you want to revoke access to

        <span class="font-semibold">{{ authorization.client_name }}</span>.
      </div>

      <div class="flex flex-row items-center mt-2 py-2 px-3 bg-gray-50 rounded-lg text-gray-700">
        <div
          class="capitalize text-ellipsis overflow-hidden font-bold select-none w-full pl-3"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          <span>
            {{ authorization.client_name }}
          </span>
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>
