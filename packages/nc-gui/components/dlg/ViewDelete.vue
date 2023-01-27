<script lang="ts" setup>
import {
  extractSdkResponseErrorMsg,
  message,
  onKeyStroke,
  useApi,
  useCommandPalette,
  useI18n,
  useNuxtApp,
  useVModel,
} from '#imports'

interface Props {
  modelValue: boolean
  view?: Record<string, any>
}

interface Emits {
  (event: 'update:modelValue', data: boolean): void
  (event: 'deleted'): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { t } = useI18n()

const vModel = useVModel(props, 'modelValue', emits)

const { api, isLoading } = useApi()

const { $e } = useNuxtApp()

onKeyStroke('Escape', () => (vModel.value = false))

onKeyStroke('Enter', () => onDelete())

/** Delete a view */
async function onDelete() {
  if (!props.view) return

  try {
    await api.dbView.delete(props.view.id)

    // View deleted successfully
    message.success(t('msg.success.viewDeleted'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  emits('deleted')

  // telemetry event
  $e('a:view:delete', { view: props.view.type })
}
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    class="!top-[35%]"
    :class="{ active: vModel }"
    :confirm-loading="isLoading"
    wrap-class-name="nc-modal-view-delete"
  >
    <template #title> {{ $t('general.delete') }} {{ $t('objects.view') }} </template>

    {{ $t('msg.info.deleteViewConfirmation') }}

    <template #footer>
      <a-button key="back" @click="vModel = false">{{ $t('general.cancel') }}</a-button>

      <a-button key="submit" danger html-type="submit" :loading="isLoading" @click="onDelete">
        {{ $t('general.submit') }}
      </a-button>
    </template>
  </a-modal>
</template>
