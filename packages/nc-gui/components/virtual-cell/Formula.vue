<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { CellValueInj, ColumnInj, computed, handleTZ, inject, ref, replaceUrlsWithLink, useProject } from '#imports'

// todo: column type doesn't have required property `error` - throws in typecheck
const column = inject(ColumnInj) as Ref<ColumnType & { colOptions: { error: any } }>

const value = inject(CellValueInj)

const { isPg } = useProject()

const showEditFormulaWarning = ref(false)

const showEditFormulaWarningMessage = () => {
  showEditFormulaWarning.value = true

  setTimeout(() => {
    showEditFormulaWarning.value = false
  }, 3000)
}

const result = computed(() => (isPg.value ? handleTZ(value) : value))

const urls = computed(() => replaceUrlsWithLink(result.value))
</script>

<template>
  <div>
    <a-tooltip v-if="column && column.colOptions && column.colOptions.error" placement="bottom" class="text-orange-700">
      <template #title>
        <span class="font-bold">{{ column.colOptions.error }}</span>
      </template>

      <span>ERR!</span>
    </a-tooltip>

    <div class="p-2" @dblclick="showEditFormulaWarningMessage">
      <div v-if="urls" v-html="urls" />

      <div v-else>{{ result }}</div>

      <div v-if="showEditFormulaWarning" class="text-left text-wrap mt-2 text-[#e65100]">
        <!-- TODO: i18n -->
        Warning: Formula fields should be configured in the field menu dropdown.
      </div>
    </div>
  </div>
</template>
