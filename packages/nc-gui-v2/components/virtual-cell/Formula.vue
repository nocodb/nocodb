<script lang="ts" setup>
import { computed, inject, ref, useProject } from '#imports'
import { CellValueInj, ColumnInj } from '~/context'
import { handleTZ, replaceUrlsWithLink } from '~/utils'

// todo: column type doesn't have required property `error` - throws in typecheck
const column: any = inject(ColumnInj)

const value = inject(CellValueInj)

const { isPg } = useProject()

const showEditFormulaWarning = ref(false)

const showEditFormulaWarningMessage = () => {
  showEditFormulaWarning.value = true

  setTimeout(() => {
    showEditFormulaWarning.value = false
  }, 3000)
}

const result = isPg ? handleTZ(value) : value

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

    <div class="pa-2" @dblclick="showEditFormulaWarningMessage">
      <div v-if="urls" v-html="urls" />
      <div v-else>{{ result }}</div>
      <div v-if="showEditFormulaWarning" class="text-left text-wrap mt-2 text-[#e65100]">
        <!-- TODO: i18n -->
        Warning: Formula fields should be configured in the field menu dropdown.
      </div>
    </div>
  </div>
</template>
