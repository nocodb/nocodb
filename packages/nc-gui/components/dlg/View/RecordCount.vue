<script setup lang="ts">
import { ViewTypes, type ViewType } from 'nocodb-sdk'
import { mergeViewRecordCountSettings, normalizeViewRecordCountSettings } from '~/utils/viewRecordCount'

const props = defineProps<{
  modelValue?: boolean
  view: ViewType & { fk_workspace_id?: string; attachment_mode_column_id?: string | null }
  roles: string | string[] | Record<string, boolean> | null | undefined
}>()
const emit = defineEmits(['update:modelValue'])
const dialogShow = useVModel(props, 'modelValue', emit)
const view = toRef(props, 'view')
const { canModifyView } = usePersonalViewPermissions(view, toRef(props, 'roles'))
const { updateView } = useViewsStore()
const settings = ref(normalizeViewRecordCountSettings(props.view.meta))
const loading = ref(false)
const isUnchanged = computed(
  () => JSON.stringify(settings.value) === JSON.stringify(normalizeViewRecordCountSettings(props.view.meta)),
)

async function save() {
  if (loading.value || !canModifyView.value || !view.value.id || view.value.type === ViewTypes.FORM) return
  if (!view.value.base_id || !view.value.fk_workspace_id) return
  loading.value = true
  try {
    await updateView(
      view.value.id,
      {
        meta: mergeViewRecordCountSettings(view.value.meta, settings.value),
        // The update endpoint derives expanded-record mode from this field, even on metadata-only updates.
        ...(view.value.attachment_mode_column_id ? { attachment_mode_column_id: view.value.attachment_mode_column_id } : {}),
      },
      { workspaceId: view.value.fk_workspace_id, baseId: view.value.base_id },
    )
    dialogShow.value = false
  } catch (error) {
    message.error(await extractSdkResponseErrorMsg(error))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <NcModal v-model:visible="dialogShow" size="small">
    <template #header>
      <div class="flex items-center gap-2">
        <GeneralViewIcon :meta="view" class="!w-5 !h-5" />
        <span>{{ $t('labels.viewRecordCount') }}</span>
      </div>
    </template>
    <div class="mb-4 text-nc-content-gray-subtle">{{ view.title }}</div>
    <DlgViewRecordCountFields v-model="settings" :disabled="loading || !canModifyView" />
    <div class="flex justify-end gap-2 mt-5">
      <NcButton type="secondary" size="small" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>
      <NcButton type="primary" size="small" :loading="loading" :disabled="!canModifyView || isUnchanged" @click="save">
        {{ $t('general.save') }}
      </NcButton>
    </div>
  </NcModal>
</template>
