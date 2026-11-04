<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'
import type { ViewType } from 'nocodb-sdk'
import { NcListViewSelector } from '#components'

const props = defineProps<{
  modelValue: any
}>()

const emits = defineEmits<{
  'update:modelValue': (value: any) => void
}>()

const vModel = useVModel(props, 'modelValue', emits)

const { t } = useI18n()

const { $api, $e } = useNuxtApp()

const meta = inject(MetaInj, ref())

const viewsStore = useViewsStore()
const { viewsByTable } = storeToRefs(viewsStore)

const viewSelectorRef = ref<InstanceType<typeof NcListViewSelector>>()

const filterFormViews = (view: ViewType) => view.type === ViewTypes.FORM

const selectedFormViewId = computed({
  get: () => vModel.value.fk_form_view_id,
  set: (val: string | undefined) => {
    vModel.value.fk_form_view_id = val
  },
})

const isSelectedViewShared = computed(() => {
  return !!viewSelectorRef.value?.selectedView?.uuid
})

const isSharingForm = ref(false)

// Update the selected form view's share state in the views store so the
// picker + badge + warning reflect the new state without a refetch.
function patchViewInStore(viewId: string, patch: Partial<ViewType>) {
  if (!meta.value?.base_id || !meta.value?.id) return
  const key = `${meta.value.base_id}:${meta.value.id}`
  const tableViews = viewsByTable.value.get(key)
  if (!tableViews) return
  const idx = tableViews.findIndex((v) => v.id === viewId)
  if (idx === -1) return
  tableViews[idx] = { ...tableViews[idx], ...patch }
  viewsByTable.value.set(key, [...tableViews])
}

async function unshareForm(viewId: string) {
  if (!meta.value?.fk_workspace_id || !meta.value?.base_id) return
  await $api.internal.postOperation(meta.value.fk_workspace_id, meta.value.base_id, { operation: 'shareViewDelete', viewId }, {})
  patchViewInStore(viewId, { uuid: undefined, password: undefined })
}

async function shareSelectedForm() {
  const viewId = selectedFormViewId.value
  if (!viewId || !meta.value?.fk_workspace_id || !meta.value?.base_id || isSharingForm.value) return

  isSharingForm.value = true
  try {
    const response = (await $api.internal.postOperation(
      meta.value.fk_workspace_id,
      meta.value.base_id,
      { operation: 'shareView', viewId },
      {},
    )) as Partial<ViewType>

    patchViewInStore(viewId, response)

    $e('c:button:open-form:share-linked-form', { via: 'inline' })

    message.success({
      title: t('msg.info.formSharedPublicly'),
      action: h(
        resolveComponent('NcButton') as any,
        {
          size: 'xs',
          type: 'secondary',
          onClick: async () => {
            try {
              await unshareForm(viewId)
              $e('c:button:open-form:share-linked-form:undo')
              message.toast(t('msg.info.formShareReverted'))
            } catch (e: any) {
              message.error(await extractSdkResponseErrorMsg(e))
            }
          },
        },
        () => t('general.undo'),
      ),
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isSharingForm.value = false
  }
}
</script>

<template>
  <div>
    <NcListViewSelector
      ref="viewSelectorRef"
      v-model:value="selectedFormViewId"
      :table-id="meta?.id"
      :filter-view="filterFormViews"
      force-fetch-views
    >
      <template #label>
        {{ t('labels.formView') }}
      </template>
      <template #listItemContent="{ option }">
        <NcTooltip class="truncate min-w-0 max-w-50" show-on-truncate-only>
          <template #title>{{ option.label }}</template>
          {{ option.label }}
        </NcTooltip>
        <span v-if="option?.uuid" class="text-captionSm text-nc-content-green-dark inline-flex items-center gap-1 flex-none">
          <GeneralIcon icon="ncGlobe" class="w-3 h-3" />
          {{ t('general.shared') }}
        </span>
        <span v-else class="text-captionSm text-nc-content-gray-muted inline-flex items-center gap-1 flex-none">
          <GeneralIcon icon="ncLock" class="w-3 h-3" />
          {{ t('general.private') }}
        </span>
        <div class="flex-1" />
      </template>
    </NcListViewSelector>
    <div v-if="selectedFormViewId && !isSelectedViewShared" class="mt-2 flex items-center gap-2 flex-wrap">
      <span class="text-xs text-nc-content-red-dark">
        {{ $t('msg.info.formNotSharedShort') }}
      </span>
      <NcButton
        size="xs"
        type="secondary"
        :loading="isSharingForm"
        data-testid="nc-open-form-share-linked-form"
        @click="shareSelectedForm"
      >
        <template #icon>
          <GeneralIcon icon="ncGlobe" class="w-3.5 h-3.5" />
        </template>
        {{ $t('general.shareForm') }}
      </NcButton>
    </div>
  </div>
</template>
