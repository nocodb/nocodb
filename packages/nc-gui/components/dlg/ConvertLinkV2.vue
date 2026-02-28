<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes } from 'nocodb-sdk'

interface Props {
  visible?: boolean
  column?: ColumnType
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
})

const emit = defineEmits(['update:visible', 'converted'])

const visible = useVModel(props, 'visible', emit)

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { getMeta } = useMetas()

const meta = inject(MetaInj, ref())

const { eventBus } = useSmartsheetStoreOrThrow()

const reloadDataHook = inject(ReloadViewDataHookInj, undefined)

const isConverting = ref(false)

const colOptions = computed(() => props.column?.colOptions as LinkToAnotherRecordType | undefined)

const isMM = computed(() => colOptions.value?.type === RelationTypes.MANY_TO_MANY)

const isParentSide = computed(() => {
  if (!colOptions.value?.type) return false
  return (
    colOptions.value.type === RelationTypes.HAS_MANY ||
    colOptions.value.type === RelationTypes.MANY_TO_MANY ||
    (colOptions.value.type === RelationTypes.ONE_TO_ONE && !props.column?.meta?.bt)
  )
})

async function handleConvert() {
  if (!props.column?.id || !meta.value) return

  isConverting.value = true

  try {
    await $api.internal.postOperation(
      meta.value.fk_workspace_id!,
      meta.value.base_id!,
      { operation: 'convertLinkToV2', columnId: props.column.id },
      {},
    )

    message.success(t('msg.info.convertLinkV2Success'))

    // Reload current table meta
    await getMeta(meta.value.base_id!, meta.value.id!, true)

    // Reload related table meta (paired column changed too)
    const relatedModelId = colOptions.value?.fk_related_model_id
    if (relatedModelId) {
      await getMeta(meta.value.base_id!, relatedModelId, true)
    }

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    reloadDataHook?.trigger()

    $e('a:field:convert-link-v2')

    emit('converted')
    visible.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isConverting.value = false
  }
}
</script>

<template>
  <NcModal v-model:visible="visible" size="small" :show-separator="false" :centered="false">
    <template #header>
      <div class="flex flex-row items-center gap-x-2">{{ $t('title.convertLegacyLink') }}</div>
    </template>

    <div class="flex flex-col" @click.stop>
      <div v-if="column" class="bg-nc-bg-gray-light rounded-lg p-3 mb-3">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-nc-content-gray-subtle">{{ $t('objects.field') }}:</span>
          <span class="font-medium">{{ column.title }}</span>
        </div>
      </div>

      <div class="text-nc-content-gray text-sm flex flex-col gap-2 mb-3">
        <p>{{ $t('msg.info.convertLinkV2Description') }}</p>

        <template v-if="isParentSide">
          <ul class="list-disc pl-5 flex flex-col gap-1 text-nc-content-gray-subtle2">
            <li>
              <span class="font-medium text-nc-content-gray">{{ column?.title }}</span>
              {{ $t('msg.info.convertLinkV2OriginalBecomesRollup') }}
            </li>
            <li>{{ $t('msg.info.convertLinkV2NewLtarCreated') }}</li>
            <li v-if="!isMM">{{ $t('msg.info.convertLinkV2FkColumnRemoved') }}</li>
          </ul>
        </template>
      </div>

      <div class="flex items-start gap-2 mb-3">
        <GeneralIcon icon="alertTriangle" class="flex-none h-4 w-4 mt-0.5 text-nc-content-yellow-medium" />
        <p class="text-xs text-nc-content-gray-muted">{{ $t('msg.info.convertLinkV2Warning') }}</p>
      </div>

      <div class="flex flex-row gap-x-2 pt-2.5 justify-end border-t-1 border-nc-border-gray-medium">
        <NcButton size="small" type="secondary" :disabled="isConverting" @click="visible = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton size="small" type="primary" :loading="isConverting" data-testid="nc-convert-link-v2-btn" @click="handleConvert">
          {{ $t('labels.convertToNewLink') }}
          <template #loading> {{ $t('general.saving') }}... </template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
