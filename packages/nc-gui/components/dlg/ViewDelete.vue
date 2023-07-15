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

const { view } = props

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
  <GeneralModal v-model:visible="vModel" centered :class="{ active: vModel }" :confirm-loading="isLoading">
    <div class="flex flex-col p-6">
      <div class="flex flex-row pb-2 mb-4 font-medium text-lg border-b-1 border-gray-50 text-gray-800">
        {{ $t('general.delete') }} {{ $t('objects.view') }}
      </div>

      <div class="mb-3 text-gray-800">Are you sure you want to delete the following view?</div>

      <div class="flex flex-row items-center py-2 px-3 bg-gray-50 rounded-lg text-gray-700 mb-4">
        <GeneralViewIcon :meta="props.view" class="nc-view-icon"></GeneralViewIcon>
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-3"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ view.title }}
        </div>
      </div>

      <div class="flex flex-row items-center py-2 px-3 border-1 border-gray-100 rounded-lg text-gray-700">
        <GeneralIcon icon="warning" class="text-orange-500"></GeneralIcon>
        <div class="pl-2 text-gray-500">This action cannot be undone</div>
      </div>

      <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 border-t-1 border-gray-50 justify-end">
        <a-button key="back" class="!rounded-md !font-medium" @click="vModel = false">{{ $t('general.cancel') }}</a-button>

        <a-button
          key="submit"
          class="!rounded-md !font-medium"
          type="danger"
          html-type="submit"
          :loading="isLoading"
          @click="onDelete"
        >
          {{ $t('general.submit') }}
        </a-button>
      </div>
    </div>
  </GeneralModal>
</template>
