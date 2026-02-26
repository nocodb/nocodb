<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, columnTypeName, isLinksOrLTAR } from 'nocodb-sdk'

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

const deleteFkColumn = ref(false)

const colOptions = computed(() => props.column?.colOptions as LinkToAnotherRecordType | undefined)

const currentTypeName = computed(() => {
  if (!colOptions.value?.type) return ''
  const typeMap: Record<string, string> = {
    hm: 'Has Many',
    bt: 'Belongs To',
    oo: 'One to One',
  }
  return typeMap[colOptions.value.type] || colOptions.value.type
})

const newTypeName = computed(() => {
  if (!colOptions.value?.type) return ''
  const typeMap: Record<string, string> = {
    hm: 'One to Many',
    bt: 'Many to One',
    oo: 'One to One (V2)',
  }
  return typeMap[colOptions.value.type] || colOptions.value.type
})

async function handleConvert() {
  if (!props.column?.id || !meta.value) return

  isConverting.value = true

  try {
    await $api.internal.postOperation(
      meta.value.fk_workspace_id!,
      meta.value.base_id!,
      { operation: 'convertLinkToV2', columnId: props.column.id, deleteFkColumn: String(deleteFkColumn.value) },
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
      <div class="text-nc-content-gray mb-3">
        <div class="flex items-start gap-2">
          <GeneralIcon icon="alertTriangle" class="flex-none h-5 w-5 mt-0.5 text-nc-content-yellow-medium" />
          <div class="flex flex-col gap-1.5">
            <p class="text-sm">{{ $t('msg.info.convertLinkV2Description') }}</p>
            <p class="text-sm font-semibold">{{ $t('msg.info.convertLinkV2Warning') }}</p>
          </div>
        </div>
      </div>

      <div v-if="column" class="bg-nc-bg-gray-light rounded-lg p-3 mb-3">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-nc-content-gray-subtle">{{ $t('objects.field') }}:</span>
          <span class="font-medium">{{ column.title }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm mt-1">
          <span class="text-nc-content-gray-subtle">{{ currentTypeName }}</span>
          <GeneralIcon icon="arrowRight" class="h-3.5 w-3.5 text-nc-content-gray-muted" />
          <span class="font-medium">{{ newTypeName }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 py-2">
        <NcSwitch v-model:checked="deleteFkColumn" size="small" data-testid="nc-convert-link-v2-delete-fk" />
        <div class="flex flex-col">
          <span class="text-sm">{{ $t('msg.info.convertLinkV2DeleteFkColumn') }}</span>
          <span v-if="!deleteFkColumn" class="text-xs text-nc-content-gray-muted">
            {{ $t('msg.info.convertLinkV2KeepFkColumnHint') }}
          </span>
        </div>
      </div>

      <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
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
