<script lang="ts" setup>
import dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { CellValueInj, ColumnInj, computed, handleTZ, inject, replaceUrlsWithLink, useProject } from '#imports'

// todo: column type doesn't have required property `error` - throws in typecheck
const column = inject(ColumnInj) as Ref<ColumnType & { colOptions: { error: any } }>

const cellValue = inject(CellValueInj)

const { isPg } = useProject()

const result = computed(() => (isPg(column.value.base_id) ? renderResult(handleTZ(cellValue?.value)) : renderResult(cellValue?.value)))

const urls = computed(() => replaceUrlsWithLink(result.value))

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning, activateShowEditNonEditableFieldWarning } =
  useShowNotEditableWarning()

const renderResult = (result?: string | null) => {
  if (!result) {
    return ''
  }
  // convert all date time values to local time
  // the input is always YYYY-MM-DD hh:mm:ss+xx:yy
  return result.replace(/\b(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\+\d{2}:\d{2})\b/g, (d) => {
    // TODO(timezone): retrieve the format from the corresponding column meta
    // assume hh:mm at this moment
    return dayjs(d).utc().local().format('YYYY-MM-DD HH:mm')
  })
}
</script>

<template>
  <div>
    <a-tooltip v-if="column && column.colOptions && column.colOptions.error" placement="bottom" class="text-orange-700">
      <template #title>
        <span class="font-bold">{{ column.colOptions.error }}</span>
      </template>
      <span>ERR!</span>
    </a-tooltip>

    <div v-else class="p-2" @dblclick="activateShowEditNonEditableFieldWarning">
      <div v-if="urls" v-html="urls" />

      <div v-else>{{ result }}</div>

      <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldEditWarning') }}
      </div>
      <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldDeleteWarning') }}
      </div>
    </div>
  </div>
</template>
