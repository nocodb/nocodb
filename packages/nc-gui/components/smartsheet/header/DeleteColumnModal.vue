<script lang="ts" setup>
import type { ColumnReqType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isLinksOrLTAR } from 'nocodb-sdk'

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

const { loadTables } = useProject()

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
  <GeneralModal v-model:visible="visible">
    <div class="flex flex-col p-6">
      <div class="flex flex-row pb-2 mb-4 font-medium text-lg border-b-1 border-gray-50 text-gray-800">
        {{ $t('general.delete') }} {{ $t('objects.column') }}
      </div>

      <div class="mb-3 text-gray-800">Are you sure you want to delete the following column?</div>

      <div v-if="column" class="flex flex-row items-center py-2 px-3 bg-gray-50 rounded-lg text-gray-700 mb-4">
        <SmartsheetHeaderCellIcon class="nc-view-icon"></SmartsheetHeaderCellIcon>
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.5"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ column.title }}
        </div>
      </div>

      <div class="flex flex-row items-center py-2 px-3.5 border-1 border-gray-100 rounded-lg text-gray-700">
        <GeneralIcon icon="warning" class="text-orange-500 ml-0.5"></GeneralIcon>
        <div class="pl-2 text-gray-500">This action cannot be undone</div>
      </div>

      <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
        <a-button key="back" class="!rounded-md !font-medium" @click="visible = false">{{ $t('general.cancel') }}</a-button>

        <a-button
          key="submit"
          class="!rounded-md !font-medium"
          type="danger"
          html-type="submit"
          :loading="isLoading"
          @click="onDelete"
        >
          {{ $t('general.delete') }} {{ $t('objects.column') }}
        </a-button>
      </div>
    </div>
  </GeneralModal>
</template>
