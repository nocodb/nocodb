<script lang="ts" setup>
import { extractSdkResponseErrorMsg, message, useApi, useNuxtApp, useVModel } from '#imports'

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

const { refreshCommandPalette } = useCommandPalette()

const { view } = props

const vModel = useVModel(props, 'modelValue', emits)

const { api } = useApi()

const { $e } = useNuxtApp()

/** Delete a view */
async function onDelete() {
  if (!props.view) return

  try {
    await api.dbView.delete(props.view.id)

    vModel.value = false
    emits('deleted')
    $e('a:view:delete', { view: props.view.type })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    refreshCommandPalette()
  }

  // telemetry event
}
</script>

<template>
  <GeneralDeleteModal v-model:visible="vModel" :entity-name="$t('objects.view')" :on-delete="onDelete">
    <template #entity-preview>
      <div v-if="view" class="flex flex-row items-center py-2 px-3 bg-gray-50 rounded-lg text-gray-700 mb-4">
        <GeneralViewIcon :meta="props.view" class="nc-view-icon"></GeneralViewIcon>
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-3"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ view.title }}
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>
