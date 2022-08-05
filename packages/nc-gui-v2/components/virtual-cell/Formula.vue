<script lang="ts" setup>
import { computed, useProject } from '#imports'
import { ColumnInj, ValueInj } from '~/context'
import { handleTZ } from '~/utils/dateTimeUtils'
import { replaceUrlsWithLink } from '~/utils/urlUtils'

const column = inject(ColumnInj)

const value = inject(ValueInj)

const { isPg } = useProject()

const showEditFormulaWarning = ref(false)

const showEditFormulaWarningMessage = () => {
  showEditFormulaWarning.value = true
  setTimeout(() => {
    showEditFormulaWarning.value = false
  }, 3000)
}

const result = computed(() => (isPg ? handleTZ(value) : value))

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

<style scoped></style>
