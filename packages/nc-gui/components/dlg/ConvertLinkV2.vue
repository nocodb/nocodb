<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'

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

// Links columns (showing count) need a Rollup + new LTAR on conversion
// LinkToAnotherRecord (LTAR v1) columns upgrade in-place — no rollup
const isLinksColumn = computed(() => (props.column ? isLink(props.column) : false))

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

    message.toast(t('msg.info.convertLinkV2Success'))

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
  <NcModal
    v-model:visible="visible"
    size="small"
    :show-separator="false"
    :centered="false"
    wrap-class-name="nc-modal-convert-link-v2"
  >
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
        <template v-if="isLinksColumn">
          <!-- Links column (v1 or v2): becomes Rollup + new LTAR is created -->
          <p>{{ $t('msg.info.convertLinkV2Description') }}</p>
        </template>
        <template v-else>
          <!-- LTAR v1 column: upgrade to junction table, no extra column created -->
          <p>{{ $t('msg.info.convertLinkV1Description') }}</p>
        </template>
      </div>

      <div class="flex items-center gap-2 mb-3 bg-orange-50 rounded-lg px-3 py-2">
        <GeneralIcon icon="alertTriangle" class="flex-none h-5 w-5 text-orange-500" />
        <i18n-t keypath="msg.info.convertLinkV2Warning" tag="span" class="text-sm text-nc-content-gray">
          <template #learnMore>
            <a
              href="https://nocodb.com/docs/product-docs/fields/field-types/links-based/link-to-another-record#upgrade-from-links-v1"
              target="_blank"
              rel="noopener noreferrer"
              class="text-nc-content-brand underline"
              >{{ $t('msg.learnMore') }}</a
            >
          </template>
        </i18n-t>
      </div>

      <div class="flex flex-row gap-x-2 pt-2.5 justify-end border-t-1 border-nc-border-gray-medium">
        <NcButton size="small" type="secondary" @click="visible = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton size="small" type="primary" :loading="isConverting" data-testid="nc-convert-link-v2-btn" @click="handleConvert">
          {{ $t('general.upgrade') }}
          <template #loading> {{ $t('general.saving') }}... </template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-convert-link-v2 {
  z-index: 1100;
}
</style>
