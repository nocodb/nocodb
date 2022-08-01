<script lang="ts" setup>
import { notification } from 'ant-design-vue'
import { extractSdkResponseErrorMsg } from '~/utils'
import { onKeyStroke, useApi, useNuxtApp, useVModel } from '#imports'

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

    notification.success({
      message: 'View deleted successfully',
      duration: 3,
    })
  } catch (e: any) {
    notification.error({
      message: await extractSdkResponseErrorMsg(e),
      duration: 3,
    })
  }

  emits('deleted')

  // telemetry event
  $e('a:view:delete', { view: props.view.type })
}
</script>

<template>
  <a-modal v-model:visible="vModel" class="!top-[35%]" :confirm-loading="isLoading">
    <template #title> {{ $t('general.delete') }} {{ $t('objects.view') }} </template>

    Are you sure you want to delete this view?

    <template #footer>
      <a-button key="back" @click="vModel = false">{{ $t('general.cancel') }}</a-button>
      <a-button key="submit" type="danger" :loading="isLoading" @click="onDelete">{{ $t('general.submit') }}</a-button>
    </template>
  </a-modal>
</template>
