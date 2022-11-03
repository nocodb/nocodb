<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { CellValueInj, ColumnInj, computed, handleTZ, inject, ref, refAutoReset, replaceUrlsWithLink, useProject } from '#imports'

// todo: column type doesn't have required property `error` - throws in typecheck
const column = inject(ColumnInj) as Ref<ColumnType & { colOptions: { error: any } }>

const cellValue = inject(CellValueInj)

const { isPg } = useProject()

const result = computed(() => (isPg.value ? handleTZ(cellValue?.value) : cellValue?.value))

const urls = computed(() => replaceUrlsWithLink(result.value))

const timeout = 3000 // in ms

const showEditFormulaWarning = refAutoReset(false, timeout)
const showClearFormulaWarning = refAutoReset(false, timeout)

useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      showEditFormulaWarning.value = true
      break
    case 'Delete':
      showClearFormulaWarning.value = true
      break
  }
})
</script>

<template>
  <div>
    <a-tooltip v-if="column && column.colOptions && column.colOptions.error" placement="bottom" class="text-orange-700">
      <template #title>
        <span class="font-bold">{{ column.colOptions.error }}</span>
      </template>

      <span>ERR!</span>
    </a-tooltip>

    <div class="p-2" @dblclick="showEditFormulaWarning = true">
      <div v-if="urls" v-html="urls" />

      <div v-else>{{ result }}</div>

      <div v-if="showEditFormulaWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        <!-- TODO: i18n -->
        Warning: Formula fields should be configured in the field menu dropdown.
      </div>
      <div v-if="showClearFormulaWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        <!-- TODO: i18n -->
        Warning: Computed field - unable to clear text.
      </div>
    </div>
  </div>
</template>
