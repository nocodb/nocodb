<script lang="ts" setup>
import type { LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, isLinksOrLTAR } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const { $api, $e } = useNuxtApp()

const column = inject(ColumnInj)

const meta = inject(MetaInj, ref())

const { getMeta } = useMetas()

const { includeM2M } = useGlobal()

const { loadTables } = useBase()

const isLoading = ref(false)

const onDelete = async () => {
  if (!column?.value) return

  isLoading.value = true

  try {
    await $api.dbTableColumn.delete(column?.value?.id as string)

    await getMeta(meta?.value?.id as string, true)

    /** force-reload related table meta if deleted column is a LTAR and not linked to same table */
    if (isLinksOrLTAR(column?.value) && column.value?.colOptions) {
      await getMeta((column.value?.colOptions as LinkToAnotherRecordType).fk_related_model_id!, true)

      // reload tables if deleted column is mm and include m2m is true
      if (includeM2M.value && (column.value?.colOptions as LinkToAnotherRecordType).type === RelationTypes.MANY_TO_MANY) {
        loadTables()
      }
    }

    $e('a:column:delete')
    visible.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <GeneralDeleteModal v-model:visible="visible" :entity-name="$t('objects.column')" :on-delete="onDelete">
    <template #entity-preview>
      <div v-if="column" class="flex flex-row items-center py-2 px-3 bg-gray-50 rounded-lg text-gray-700 mb-4">
        <SmartsheetHeaderCellIcon class="nc-view-icon"></SmartsheetHeaderCellIcon>
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.5"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ column.title }}
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>
