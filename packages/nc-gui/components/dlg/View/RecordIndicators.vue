<script setup lang="ts">
import type { TableType, ViewType } from 'nocodb-sdk'
import {
  areViewRecordIndicatorsEqual,
  isValidViewRecordIndicatorSettings,
  readViewRecordIndicators,
} from '~/lib/viewRecordIndicators'
import { persistViewRecordIndicators } from '~/lib/viewRecordIndicatorPersistence'

const props = defineProps<{
  modelValue?: boolean
  view: ViewType
  table?: TableType
}>()

const emit = defineEmits(['update:modelValue', 'updated'])
const dialogShow = useVModel(props, 'modelValue', emit)
const viewStore = useViewsStore()
const { viewsByTable } = storeToRefs(viewStore)
const { t } = useI18n()
const loading = ref(false)

// Read the action target's latest metadata, including changes made while the dialog is open.
const view = computed<ViewType & { alias?: string }>(() => {
  const baseId = props.view.base_id || props.table?.base_id
  const tableId = props.view.fk_model_id || props.table?.id
  return viewsByTable.value.get(`${baseId}:${tableId}`)?.find((item) => item.id === props.view.id) || props.view
})

const { canModifyView } = usePersonalViewPermissions(view)
const settings = ref(readViewRecordIndicators(view.value.meta))
const canSave = computed(
  () =>
    canModifyView.value &&
    isValidViewRecordIndicatorSettings(settings.value) &&
    !areViewRecordIndicatorsEqual(readViewRecordIndicators(view.value.meta), settings.value),
)

watch(
  [dialogShow, () => view.value.id],
  ([visible]) => {
    if (visible) settings.value = readViewRecordIndicators(view.value.meta)
  },
  { immediate: true },
)

async function save() {
  const target = view.value
  if (loading.value || !canSave.value || !target.id) return

  loading.value = true
  try {
    const updated = await persistViewRecordIndicators(target, settings.value, viewStore.updateView)
    emit('updated', updated)
    dialogShow.value = false
  } catch (error: any) {
    message.error((await extractSdkResponseErrorMsg(error)) || t('labels.viewRecordIndicators.updateFailed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <NcModal v-model:visible="dialogShow" size="small" :closable="!loading" :mask-closable="!loading">
    <template #header>
      <span class="font-semibold">{{ $t('labels.viewRecordIndicators.title') }}</span>
    </template>
    <div class="flex flex-col gap-4">
      <div class="text-nc-content-gray truncate">{{ view.alias || view.title }}</div>
      <SmartsheetToolbarViewRecordIndicatorsSettings v-model="settings" :disabled="loading || !canModifyView" />
      <div class="flex justify-end gap-2">
        <NcButton type="secondary" size="small" :disabled="loading" @click="dialogShow = false">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton
          type="primary"
          size="small"
          :loading="loading"
          :disabled="loading || !canSave"
          data-testid="view-indicators-save"
          @click="save"
        >
          {{ $t('general.save') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
