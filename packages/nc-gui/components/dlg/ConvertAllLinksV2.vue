<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { isLinksOrLTAR } from 'nocodb-sdk'

interface Props {
  visible?: boolean
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

const isConverting = ref(false)

const v1LinkColumns = computed(() => {
  return (meta.value?.columns ?? []).filter((c) => {
    if (!isLinksOrLTAR(c)) return false
    const opts = c.colOptions as LinkToAnotherRecordType | undefined
    return opts?.version !== 2 && opts?.type !== 'mm'
  })
})

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    hm: 'Has Many',
    bt: 'Belongs To',
    oo: 'One to One',
  }
  return map[type] || type
}

async function handleConvertAll() {
  if (!meta.value) return

  isConverting.value = true

  try {
    const result = await $api.internal.postOperation(
      meta.value.fk_workspace_id!,
      meta.value.base_id!,
      { operation: 'convertAllLinksToV2', tableId: meta.value.id },
      {},
    )

    const { converted = 0, skipped = 0 } = (result as any) || {}
    message.success(t('msg.info.convertAllLinksV2Success', { converted, skipped }))

    await getMeta(meta.value.id!, true)

    $e('a:field:convert-all-links-v2')

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
  <NcModal v-model:visible="visible" size="sm" :show-separator="false" :centered="false">
    <template #header>
      <div class="flex flex-row items-center gap-x-2">{{ $t('title.convertAllLegacyLinks') }}</div>
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

      <div v-if="v1LinkColumns.length" class="bg-nc-bg-gray-light rounded-lg p-3 mb-3 max-h-48 overflow-y-auto">
        <div class="text-xs text-nc-content-gray-subtle mb-2 font-medium">
          {{ v1LinkColumns.length }} legacy link field(s) to convert:
        </div>
        <div v-for="col in v1LinkColumns" :key="col.id" class="flex items-center gap-2 text-sm py-1">
          <span class="font-medium truncate max-w-40">{{ col.title }}</span>
          <span class="text-nc-content-gray-muted text-xs">({{ typeLabel((col.colOptions as LinkToAnotherRecordType)?.type) }})</span>
        </div>
      </div>

      <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
        <NcButton size="small" type="secondary" :disabled="isConverting" @click="visible = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          size="small"
          type="primary"
          :loading="isConverting"
          data-testid="nc-convert-all-links-v2-btn"
          @click="handleConvertAll"
        >
          {{ $t('labels.convertAllLegacyLinks') }}
          <template #loading> {{ $t('general.saving') }}... </template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
